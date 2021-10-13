export function getAbsoluteUrl(url) {
    const a = document.createElement('a');
    a.href = url;
    return a.href;
}
export function isVideo(element) {
    return element.tagName.toLowerCase() === 'video';
}
export function isAudio(element) {
    return element.tagName.toLowerCase() === 'audio';
}
export function removeElement(node) {
    if (node) {
        const { parentNode } = node;
        if (parentNode) {
            parentNode.removeChild(node);
        }
    }
}
export function loadScript(url) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.async = true;
        script.onload = () => {
            removeElement(script);
            resolve();
        };
        script.onerror = () => {
            removeElement(script);
            reject(new Error(`${url} could not be loaded`));
        };
        if (document.head) {
            document.head.appendChild(script);
        }
    });
}
export function request(url, dataType, success, error) {
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
        xhr.onreadystatechange = () => {
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
                }
                else if (typeof error === 'function') {
                    error(xhr.status);
                }
            }
        };
        xhr.send();
    }
}
export function hasClass(target, className) {
    return !!(target.className.split(' ').indexOf(className) > -1);
}
export function offset(el) {
    const rect = el.getBoundingClientRect();
    return {
        left: rect.left + (window.pageXOffset || document.documentElement.scrollLeft),
        top: rect.top + (window.pageYOffset || document.documentElement.scrollTop),
    };
}
export function sanitize(html, justText = true) {
    const parser = new DOMParser();
    const content = parser.parseFromString(html, 'text/html');
    const formattedContent = content.body || document.createElement('body');
    const scripts = formattedContent.querySelectorAll('script');
    for (let i = 0, total = scripts.length; i < total; i++) {
        scripts[i].remove();
    }
    function clean(element) {
        const nodes = element.children;
        for (let i = 0, total = nodes.length; i < total; i++) {
            const node = nodes[i];
            const { attributes } = node;
            for (let j = 0, t = attributes.length; j < t; j++) {
                const { name, value } = attributes[j];
                const val = value.replace(/\s+/g, '').toLowerCase();
                if (['src', 'href', 'xlink:href'].includes(name)) {
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
export function isXml(input) {
    let parsedXml;
    if (typeof DOMParser !== 'undefined') {
        parsedXml = (text) => new DOMParser().parseFromString(text, 'text/xml');
    }
    else if (typeof ActiveXObject !== 'undefined' && new ActiveXObject('Microsoft.XMLDOM')) {
        parsedXml = (text) => {
            const xmlDoc = new ActiveXObject('Microsoft.XMLDOM');
            xmlDoc.async = false;
            xmlDoc.loadXML(text);
            return xmlDoc;
        };
    }
    else {
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
    }
    catch (e) {
        return false;
    }
    return true;
}
export function isJson(item) {
    item = typeof item !== 'string' ? JSON.stringify(item) : item;
    try {
        item = JSON.parse(item);
    }
    catch (e) {
        return false;
    }
    if (typeof item === 'object' && item !== null) {
        return true;
    }
    return false;
}
