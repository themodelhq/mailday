import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'net';

export type ScanResult = 'CLEAN' | 'INFECTED' | 'UNCHECKED';

@Injectable()
export class AttachmentScanner {
  private readonly logger = new Logger(AttachmentScanner.name);
  private readonly host = process.env.CLAMAV_HOST || '';
  private readonly port = Number(process.env.CLAMAV_PORT || 3310);
  private readonly timeoutMs = Number(process.env.CLAMAV_TIMEOUT_MS || 10000);

  async scan(buffer: Buffer): Promise<ScanResult> {
    if (!this.host) return 'UNCHECKED';
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      let response = '';
      let settled = false;
      const finish = (error?: Error, result?: ScanResult) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        if (error) reject(error); else resolve(result!);
      };
      socket.setTimeout(this.timeoutMs);
      socket.on('timeout', () => finish(new Error('ClamAV scan timed out')));
      socket.on('error', error => finish(error));
      socket.on('data', chunk => {
        response += chunk.toString('utf8');
        if (response.includes('\\0')) {
          const reply = response.replace(/\\0/g, '').trim();
          if (/OK$/.test(reply)) finish(undefined, 'CLEAN');
          else if (/FOUND$/.test(reply)) finish(undefined, 'INFECTED');
          else finish(new Error('Unexpected ClamAV response: ' + reply.slice(0, 200)));
        }
      });
      socket.connect(this.port, this.host, () => {
        socket.write('zINSTREAM\\0');
        for (let offset = 0; offset < buffer.length; offset += 64 * 1024) {
          const chunk = buffer.subarray(offset, Math.min(offset + 64 * 1024, buffer.length));
          const size = Buffer.alloc(4);
          size.writeUInt32BE(chunk.length);
          socket.write(size);
          socket.write(chunk);
        }
        socket.write(Buffer.alloc(4));
      });
    });
  }
}