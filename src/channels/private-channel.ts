let request = require('request');
let url = require('url');
import axios from 'axios';
import {Log} from '../log';

export class PrivateChannel {
    /**
     * Request client.
     */
    private request: any;

    /**
     * Create a new private channel instance.
     */
    constructor(private options: any) {
        this.request = request;
    }

    /**
     * Send authentication request to application server.
     */
    authenticate(socket: any, data: any): Promise<any> {

        if (this.options.devMode) {
            Log.info(`[Data from socket for auth\n`);
        }
        console.log('data from socket', data)
        console.log('\n')

        let options = {
            url: this.authHost(socket) + this.options.authEndpoint,
            form: {channel_name: data.channel},
            headers: (data.auth && data.auth.headers) ? data.auth.headers : {},
            rejectUnauthorized: false
        };

        return this.serverRequest(socket, options);
    }

    /**
     * Get the auth host based on the Socket.
     */
    protected authHost(socket: any): string {
        let authHosts = (this.options.authHost) ?
            this.options.authHost : this.options.host;

        if (typeof authHosts === "string") {
            authHosts = [authHosts];
        }

        let authHostSelected = authHosts[0] || 'http://localhost';

        if (socket.request.headers.referer) {
            let referer = url.parse(socket.request.headers.referer);

            for (let authHost of authHosts) {
                authHostSelected = authHost;

                if (this.hasMatchingHost(referer, authHost)) {
                    authHostSelected = `${referer.protocol}//${referer.host}`;
                    break;
                }
            }
        }

        if (this.options.devMode) {
            Log.error(`[${new Date().toLocaleTimeString()}] - Preparing authentication request to: ${authHostSelected}`);
        }

        return authHostSelected;
    }

    /**
     * Check if there is a matching auth host.
     */
    protected hasMatchingHost(referer: any, host: any): boolean {
        return referer.hostname.substr(referer.hostname.indexOf('.')) === host ||
            `${referer.protocol}//${referer.host}` === host ||
            referer.host === host;
    }

    /**
     * Send a request to the server.
     */
    protected serverRequest(socket: any, options: any): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            options.headers = this.prepareHeaders(socket, options);
            axios.post(options.url, options.form, {
                headers: options.headers
            }).then(r => {
                if (r.status !== 200) {
                    if (this.options.devMode) {
                        Log.warning(`[${new Date().toLocaleTimeString()}] - ${socket.id} could not be authenticated to ${options.form.channel_name}`);
                        Log.error(r.data);
                    }

                    reject({reason: 'Client can not be authenticated, got HTTP status ' + r.status, status: r.status});
                } else {
                    if (this.options.devMode) {
                        Log.info(`[${new Date().toLocaleTimeString()}] - ${socket.id} authenticated for: ${options.form.channel_name}`);
                    }

                    let body

                    try {
                        body = JSON.parse(r.data);
                    } catch (e) {
                        body = r.data
                    }

                    resolve(body);
                }
            }).catch(error => {
                if (this.options.devMode) {
                    Log.error(`[${new Date().toLocaleTimeString()}] - Error authenticating ${socket.id} for ${options.form.channel_name}`);
                    Log.error(error);
                }

                reject({reason: 'Error sending authentication request.', status: 0});
            })
        });
    }

    /**
     * Prepare headers for request to app server.
     */
    protected prepareHeaders(socket: any, options: any): any {
        options.headers['Cookie'] = options.headers['Cookie'] || socket.request.headers.cookie;
        options.headers['X-Requested-With'] = 'XMLHttpRequest';

        return options.headers;
    }
}
