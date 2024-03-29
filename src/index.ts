/*
Author: Ing. Luca Gian Scaringella
GitHub: LucaCode
Copyright(c) Ing. Luca Gian Scaringella
 */

import {Readable, ReadableOptions, Writable, WritableOptions} from "stream";
import {ReadStream, StreamCloseCode, StreamCloseError, StreamState, WriteStream} from "ziron-engine";

type ToReadableOptions = Pick<ReadableOptions,'highWaterMark' | 'encoding'>;
type ToWriteableOptions = Pick<WritableOptions,'highWaterMark'>;

declare module "ziron-engine" {
    interface ReadStream {
        /**
         * @description
         * Creates a Node.Js Readable and connects it to the ReadStream.
         * @param options
         */
        toReadable(options?: ToReadableOptions): Readable;
    }
    interface WriteStream {
        /**
         * @description
         * Creates a Node.Js Writable and connects it to the WriteStream.
         * @param options
         */
        toWriteable(options?: ToWriteableOptions)
    }
}

ReadStream.prototype.toReadable = function toReadable(options: ToReadableOptions = {}) {
    const stream = this;
    const binary = stream.binary;
    return new Readable({
        ...options,
        objectMode: !binary,
        construct(callback: (error?: (Error | null)) => void) {
            stream.opened
                .catch(callback)
                .then(() => callback());
        },
        async read() {
            const res = await stream.read();
            if(res === null) {
                if(stream.closeCode !== StreamCloseCode.End)
                    this.destroy(new StreamCloseError(stream.closeCode!));
                else this.push(null);
            }
            else this.push(binary ? new Uint8Array(res as ArrayBuffer) : res);
        },
        destroy(error, callback) {
            if(stream.state !== StreamState.Closed)
                stream.close(StreamCloseCode.Abort);
            callback(error);
        }
    });
}

WriteStream.prototype.toWriteable = function toWriteable(options: ToWriteableOptions = {}) {
    const stream = this;
    const binary = stream.binary;
    return new Writable({
        ...options,
        objectMode: !binary,
        decodeStrings: true,
        construct(callback: (error?: (Error | null)) => void) {
            stream.opened
                .catch(callback)
                .then(() => callback());
        },
        write(chunk: any, _: BufferEncoding, callback: (error?: (Error | null)) => void) {
            stream.write(binary ? (chunk as Buffer).buffer : chunk)
                .catch(callback)
                .then((res) => {
                    if(res) callback();
                    else callback(stream.closeCode != null ?
                        new StreamCloseError(stream.closeCode) :
                        new Error("WriteStream is not open."))
                });
        },
        destroy(error, callback) {
            if(stream.state !== StreamState.Closed)
                stream.close(StreamCloseCode.Abort);
            callback(error);
        },
        final(callback: (error?: (Error | null)) => void) {
            stream.end()
                .catch(callback)
                .then(() => callback());
        }
    });
}