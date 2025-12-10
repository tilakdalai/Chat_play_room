import WebTorrent, { Torrent, TorrentFile } from 'webtorrent';
import { Request, Response } from 'express';

type NodeWebTorrentClient = InstanceType<typeof WebTorrent> & {
  get(id: string | Buffer): Torrent | null;
};

const client: NodeWebTorrentClient = new (WebTorrent as any)();

function pickBestFile(torrent: Torrent): TorrentFile {
  const videoFiles = torrent.files.filter((f: TorrentFile) => /\.(mp4|mkv|webm|mov|avi)$/i.test(f.name));
  if (videoFiles.length > 0) {
    return videoFiles.sort((a: TorrentFile, b: TorrentFile) => b.length - a.length)[0];
  }
  return torrent.files[0];
}

function cleanupTorrent(infoHash: string) {
  try {
    const existing = client.get(infoHash) as unknown as Torrent | null;
    if (existing) {
      existing.destroy();
    }
  } catch (err) {
    // Ignore cleanup errors
  }
}

export async function streamTorrent(magnet: string, req: Request, res: Response) {
  return new Promise<void>((resolve, reject) => {
    const existing = client.get(magnet) as unknown as Torrent | null;
    const onTorrent = (torrent: Torrent) => {
      const file = pickBestFile(torrent);
      if (!file) {
        cleanupTorrent(torrent.infoHash);
        return reject(new Error('No playable files in torrent'));
      }

      const total = file.length;
      const range = req.headers.range;
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');

      if (range) {
        const match = /bytes=(\d+)-(\d*)/.exec(range);
        if (!match) {
          res.status(416).end();
          cleanupTorrent(torrent.infoHash);
          return resolve();
        }
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : total - 1;
        if (start >= total || end >= total) {
          res.status(416).end();
          cleanupTorrent(torrent.infoHash);
          return resolve();
        }
        const chunkSize = end - start + 1;
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
        res.setHeader('Content-Length', String(chunkSize));

        const stream = file.createReadStream({ start, end });
        stream.pipe(res);
        stream.on('end', () => {
          cleanupTorrent(torrent.infoHash);
          resolve();
        });
        stream.on('error', (err: any) => {
          cleanupTorrent(torrent.infoHash);
          reject(err);
        });
      } else {
        res.status(200);
        res.setHeader('Content-Length', String(total));
        const stream = file.createReadStream();
        stream.pipe(res);
        stream.on('end', () => {
          cleanupTorrent(torrent.infoHash);
          resolve();
        });
        stream.on('error', (err: any) => {
          cleanupTorrent(torrent.infoHash);
          reject(err);
        });
      }
    };

    if (existing) {
      onTorrent(existing);
    } else {
      client.add(magnet, { destroyStoreOnDestroy: true }, onTorrent);
    }
  });
}
