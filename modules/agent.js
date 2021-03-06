import { request } from 'https';
import URL from 'url';
import querystring from 'querystring'
import { CookiesBox } from "./cookies.js";
import log4js from 'log4js';

const log = log4js.getLogger('http');


const DEFAULT_HEADERS = {
	'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
	// 'Accept-Encoding': 'gzip, deflate, br',
	'Accept-Language': 'en,he;q=0.9,ru;q=0.8,en-US;q=0.7',
	'Connection': 'keep-alive',
	'DNT': '1',
	'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36',
}

export class HttpUserAgent {
	
	timeout = 10000;
	cookies = new CookiesBox();
	host = null;
	referer = null;
	
	constructor(host, referer) {
		this.host = host;
		this.referer = referer;
	}

	async httpRequest(options, xhr, data) {
		return new Promise((rs, rj) => {			
			options.host = this.host;
			if (options.timeout == null) {
				options.timeout = this.timeout;
			}
			if (this.referer != null) {
				options.headers['referer'] = this.referer;
			}
			options.headers['cookie'] = this.cookies.asHeaderValue();
			log.debug('Request:', JSON.stringify({ method: options.method, path: options.path, xhr, headers: options.headers }));
			const crq = request(options);
			crq.on('abort', (arg) => log.debug('abort'));			
			// crq.on('socket', (arg) => log.debug('socket'));
			crq.on('timeout', (arg) => log.debug('timeout'));
			crq.on('response', (resp) => {
				resp.setEncoding('utf8');
				const setCookie = resp.headers['set-cookie'];
				if (setCookie != null) {
					this.cookies.set(setCookie);
				} 				
				const content = [];
				resp.on('data', (chunk) => {
					content.push(chunk);
				});
				resp.on('end', () => {
					if (!xhr && crq.method === 'GET') {
						this.referer = `${crq.agent.protocol}//${this.host}${options.path}`;
					}
					log.debug('Response:', JSON.stringify({ status: resp.statusCode, headers: resp.headers }));
					rs({
						statusCode: resp.statusCode,
						headers: resp.headers,
						content: content.join(''),
					});
				});
			});
			if (data != null) {
				crq.write(data);
			}
			crq.end();
		});
	}


	async hadleRedirectIdNeed(resp) {
		const code = resp.statusCode;
		if (code === 302 || code === 307) {
			const redirect = resp.headers['location'];
			const url = URL.parse(redirect);			
			log.debug('redirecting to', redirect);
			this.host = url.host;
			return this.navigate(url.path);
		}
		return resp;
	}

	async navigate(pathName, query) {
		const headers = { ...DEFAULT_HEADERS };
		const method = 'GET';
		const path = query == null ? pathName : `${pathName}?${querystring.stringify(query)}`;
		const result = await this.httpRequest({ method, path, headers });
		return this.hadleRedirectIdNeed(result);
	}

	async postForm(path, form) {		
		const method = 'POST';
		const postData = querystring.stringify(form);
		const headers = { 
			...DEFAULT_HEADERS,
			'Content-Type': 'application/x-www-form-urlencoded',
			'Content-Length': Buffer.byteLength(postData),
		};
		const result = await this.httpRequest({ method, path, headers }, false, postData);
		return this.hadleRedirectIdNeed(result);		
	}

	async xhrGet(pathName, query) {
		const headers = { ...DEFAULT_HEADERS };
		const method = 'GET';
		const path = query == null ? pathName : `${pathName}?${querystring.stringify(query)}`;
		return await this.httpRequest({ method, path, headers });
	}

	async xhrDelete(pathName, query) {
		const headers = { ...DEFAULT_HEADERS };
		const method = 'DELETE';
		const path = query == null ? pathName : `${pathName}?${querystring.stringify(query)}`;
		return await this.httpRequest({ method, path, headers });
	}

}
