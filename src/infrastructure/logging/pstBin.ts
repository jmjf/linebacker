import pump from 'pump';
import build from './pinoSplunkTransport';

// my default opts are good for now
const pst = build({});
pump(process.stdin, pst);
