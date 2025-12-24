import winston from 'winston';
import util from 'util';

const logLevel = process.env.LOG_LEVEL ? process.env.LOG_LEVEL.toLowerCase() : 'info';

const format = winston.format.printf(({ level, message, label, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${process.pid}] [${label}] ${level.toUpperCase()}: ${message}`;
    // Check if there is extra context (metadata)
    if (metadata && Object.keys(metadata).length > 0) {
        msg += ` ${util.inspect(metadata, { colors: true, depth: null })}`;
    }
    return msg;
});

export const getLogger = (label: string) => {
    return winston.createLogger({
        level: logLevel,
        format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.label({ label }),
            format
        ),
        transports: [
            new winston.transports.Console()
        ]
    });
};
