declare const ActiveXObject: any;

/**
 * Get the complete URL of a relative path.
 *
 * @export
 * @param {string} url
 * @returns {string}
 */
export function getAbsoluteUrl(url: string): string {
    const a: HTMLAnchorElement = document.createElement('a');
    a.href = url;
    return a.href;
}

/**
 * Determine if element is a video element.
 *
 * @export
 * @param {Element} element
 * @return {boolean}
 */
export function isVideo(element: Element): boolean {
    return element.tagName.toLowerCase() === 'video';
}

/**
 * Determine if element is a audio element.
 *
 * @export
 * @param {Element} element
 * @return {boolean}
 */
export function isAudio(element: Element): boolean {
    return element.tagName.toLowerCase() === 'audio';
}

/**
 * Remove a node using removeChild as a way to support IE11
 *
 * @export
 * @param {Node} node
 * @returns {void}
 */
export function removeElement(node?: Node): void {
    if (node) {
        const { parentNode } = node;
        if (parentNode) {
            parentNode.removeChild(node);
        }
    }
}

/**
 * Load an external script using Promises
 *
 * @export
 * @param {string} url
 * @returns {Promise}
 */
export function loadScript(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.async = true;
        script.onload = (): void => {
            removeElement(script);
            resolve();
        };
        script.onerror = (): void => {
            removeElement(script);
            reject(new Error(`${url} could not be loaded`));
        };
        if (document.head) {
            document.head.appendChild(script);
        }
    });
}

/**
 * Perform an asynchronous (AJAX) request.
 *
 * @export
 * @param {string} url
 * @param {string} dataType
 * @param {function} success
 * @param {function} error
 */
export function request(url: string, dataType: string, success: (n: any) => any, error?: (n: any) => any): void {
    const xhr = XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject('Microsoft.XMLHTTP');

    let type;
    switch (dataType) {
        case 'text':
            type = 'text/plain';
            break;
        case 'json':
            type = 'application/json, text/javascript';
            break;
        case 'html':
            type = 'text/html';
            break;
        case 'xml':
            type = 'application/xml, text/xml';
            break;
        default:
            type = 'application/x-www-form-urlencoded; charset=UTF-8';
            break;
    }

    let completed = false;
    const accept = type !== 'application/x-www-form-urlencoded' ? `${type}, */*; q=0.01` : '*/'.concat('*');

    if (xhr) {
        xhr.open('GET', url, true);
        xhr.setRequestHeader('Accept', accept);
        xhr.onreadystatechange = (): void => {
            // Ignore repeat invocations
            if (completed) {
                return;
            }

            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    completed = true;
                    let data;
                    switch (dataType) {
                        case 'json':
                            data = JSON.parse(xhr.responseText);
                            break;
                        case 'xml':
                            data = xhr.responseXML;
                            break;
                        default:
                            data = xhr.responseText;
                            break;
                    }
                    success(data);
                } else if (typeof error === 'function') {
                    error(xhr.status);
                }
            }
        };
        xhr.send();
    }
}

/**
 * Determine if element has a specific class.
 *
 * @export
 * @param {HTMLElement} target  The target element.
 * @param {string} className   The class to search in the `class` attribute.
 * @returns {boolean}
 */
export function hasClass(target: HTMLElement, className: string): boolean {
    return !!(target.className.split(' ').indexOf(className) > -1);
}

/**
 * Obtain the top/left offset values of an element.
 *
 * @export
 * @param {HTMLElement} el  The target element.
 * @returns {object}
 */
export function offset(el: HTMLElement): { left: number; top: number } {
    const rect = el.getBoundingClientRect();
    return {
        left: rect.left + (window.pageXOffset || document.documentElement.scrollLeft),
        top: rect.top + (window.pageYOffset || document.documentElement.scrollTop),
    };
}

export function sanitize(html: string, justText = true): string {
    const parser = new DOMParser();
    const content = parser.parseFromString(html, 'text/html');
    const formattedContent = content.body || document.createElement('body');

    const scripts = formattedContent.querySelectorAll('script');
    for (let i = 0, total = scripts.length; i < total; i++) {
        scripts[i].remove();
    }

    function clean(element: Element): void {
        const nodes = element.children;
        for (let i = 0, total = nodes.length; i < total; i++) {
            const node = nodes[i];
            const { attributes } = node;
            for (let j = 0, t = attributes.length; j < t; j++) {
                const { name, value } = attributes[j];
                const val = value.replace(/\s+/g, '').toLowerCase();
                if (['src', 'href', 'xlink:href'].includes(name)) {
                    // eslint-disable-next-line no-script-url
                    if (val.includes('javascript:') || val.includes('data:')) {
                        node.removeAttribute(name);
                    }
                }
                if (name.startsWith('on')) {
                    node.removeAttribute(name);
                }
            }
            clean(node);
        }
    }

    clean(formattedContent);
    return justText ? (formattedContent.textContent || '').replace(/\s{2,}/g, '') : formattedContent.innerHTML;
}

/**
 * Determine if string is a valid XML structure.
 *
 * @export
 * @param {string} input
 * @returns {boolean}
 */
export function isXml(input: string): boolean {
    let parsedXml;

    if (typeof DOMParser !== 'undefined') {
        parsedXml = (text: string): any => new DOMParser().parseFromString(text, 'text/xml');
    } else if (typeof ActiveXObject !== 'undefined' && new ActiveXObject('Microsoft.XMLDOM')) {
        parsedXml = (text: string): any => {
            const xmlDoc = new ActiveXObject('Microsoft.XMLDOM');
            xmlDoc.async = false;
            xmlDoc.loadXML(text);
            return xmlDoc;
        };
    } else {
        return false;
    }

    try {
        const response = parsedXml(input);
        if (response.getElementsByTagName('parsererror').length > 0) {
            return false;
        }

        if (response.parseError && response.parseError.errorCode !== 0) {
            return false;
        }
    } catch (e) {
        return false;
    }
    return true;
}

export function isJson(item: any): boolean {
    item = typeof item !== 'string' ? JSON.stringify(item) : item;
    try {
        item = JSON.parse(item);
    } catch (e) {
        return false;
    }

    if (typeof item === 'object' && item !== null) {
        return true;
    }

    return false;
}
