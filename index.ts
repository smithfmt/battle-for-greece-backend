#!/usr/bin/env node

/**
 * Module dependencies.
 */

import app from './app';
import debug from 'debug';
debug('api:server');
import http from 'http';

/**
 * Normalize a port into a number, string, or false.
 */

const normalizePort = (val:any) => {
  const normalPort = parseInt(val, 10);
  if (isNaN(normalPort)) {
    // named pipe
    return val;
  };
  if (normalPort >= 0) {
    // port number
    return normalPort;
  };
  return false;
};

/**
 * Get port from environment and store in Express.
 */

const port = normalizePort( '7000');
app.set('port', port);

/**
 * Create HTTP server.
 */

const server = http.createServer(app);


/**
 * Event listener for HTTP server "error" event.
 */

 const onError = (error:any) => {
  if (error.syscall !== 'listen') {
    throw error;
  };

  const bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
    default:
      throw error;
  };
};

/**
 * Event listener for HTTP server "listening" event.
 */

 const onListening = () => {
  const addr = server.address();
  const bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
};

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);


