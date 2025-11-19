/**
 * =================================================================
 * script.js - Math Learning Center Core Logic (Final Optimized Version)
 * -----------------------------------------------------------------
 * * Update Log:
 * 1. Implemented Lazy Loading for 'Plotly' and 'BigNumber.js' to improve initial load speed (LCP).
 * 2. Fixed Plotly version to v2.27.0 to resolve console warnings.
 * 3. Added UI blocking (loading state) during high-precision calculations to improve UX.
 *
 * =================================================================
 */

// --- 1. Global Variables & Math Functions ---

const contentContainer = document.getElementById('content-container');

// Core Math Functions for Plotting
const f_deriv = x => 0.5 * x * x + 1;
const fPrime_deriv = x => x;
const f_mvt = x => x * x * x - 6 * x * x + 5;
const fPrime_mvt = x => 3 * x * x - 12 * x;
const f_taylor = x => Math.sin(x);
const fPrime_taylor = x => Math.cos(x);
const fTriplePrime_taylor = x => -Math.cos(x);
const fPentaPrime_taylor = x => Math.cos(x);
const taylorPolynomial = (x, n) => {
    let p = 0;
    if (n >= 1) p += fPrime_taylor(0) * x;
    if (n >= 3) p += fTriplePrime_taylor(0) / 6 * Math.pow(x, 3);
    if (n >= 5) p += fPentaPrime_taylor(0) / 120 * Math.pow(x, 5);
    return p;
};
const f_integral = x => 2 + Math.cos(x * Math.PI / 4);
const integral_a = 0, integral_b = 5;
const x_vals_default = Array.from({ length: 101 }, (_, i) => -5 + i * 0.1);
const y_vals_deriv = x_vals_default.map(f_deriv);


// --- 2. Dynamic Resource Loader (Fixes 'Unused JS' & 'Render Blocking') ---

const loadedLibraries = new Set();

/**
 * Dynamically loads a script file.
 * @param {string} url - The URL of the script.
 * @param {string} globalName - The global variable name (e.g., 'Plotly') to check existence.
 */
async function loadLibrary(url, globalName) {
    // If tracked as loaded, skip
    if (loadedLibraries.has(url)) return;

    // If global variable exists (maybe loaded by other means), mark as loaded and skip
    if (globalName && window[globalName]) {
        loadedLibraries.add(url);
        return;
    }

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.async = true;
        script.onload = () => {
            console.log(`[LazyLoad] Library loaded: ${globalName || url}`);
            loadedLibraries.add(url);
            resolve();
        };
        script.onerror = () => {
            console.error(`[LazyLoad] Failed to load library: ${url}`);
            reject(new Error(`Failed to load ${url}`));
        };
        document.head.appendChild(script);
    });
}

/**
 * Loads specific libraries based on the current page ID.
 */
async function loadRequiredLibraries(pageId) {
    // 1. BigNumber.js: Only for Precision Calculator
    if (pageId === 'precision-calc') {
        await loadLibrary('https://cdn.jsdelivr.net/npm/bignumber.js/bignumber.min.js', 'BigNumber');
    }

    // 2. Plotly.js: Only for visualization pages
    // Using v2.27.0 to fix 'outdated version' warning in Lighthouse
    const plotlyPages = ['derivative', 'limits', 'differential', 'integral', 'polyfit'];
    if (plotlyPages.includes(pageId)) {
        await loadLibrary('https://cdn.plot.ly/plotly-2.27.0.min.js', 'Plotly');
    }
}


// --- 3. Page Loading & Initialization Logic ---

function renderAllKatex() {
    if (typeof katex === 'undefined') return;
    document.querySelectorAll('[data-katex], .katex-render').forEach(el => {
        const text = el.getAttribute('data-katex') || el.textContent;
        katex.render(text, el, { throwOnError: false, displayMode: el.tagName !== 'SPAN' });
    });
    document.querySelectorAll('[data-latex-inline]').forEach(span => {
        if (span.classList.contains('latex-box')) return;
        const latex = span.getAttribute('data-latex-inline');
        const wrapper = document.createElement('span');
        wrapper.className = 'latex-box';
        katex.render(latex, wrapper, { throwOnError: false, displayMode: false });
        span.parentNode.replaceChild(wrapper, span);
    });
    document.querySelectorAll('nav .latex-box[data-original-latex]').forEach(span => {
        katex.render(span.getAttribute('data-original-latex'), span, { throwOnError: false, displayMode: false });
    });
    document.querySelectorAll('.calc-button[data-op], .calc-button[data-value], .calc-button[data-function], .calc-operator[data-op]').forEach(button => {
        const buttonText = button.textContent.trim();
        if (buttonText.startsWith('$') && buttonText.endsWith('$')) {
            katex.render(buttonText.slice(1, -1), button, { throwOnError: false });
        }
    });
}

window.toggleSolution = id => {
    const el = document.getElementById(id);
    if (el) el.style.display = el.style.display === 'block' ? 'none' : 'block';
};

function relayoutPlots(plotIds) {
    setTimeout(() => {
        plotIds.forEach(id => {
            const plotDiv = document.getElementById(id);
            // Ensure Plotly is loaded before calling its methods
            if (plotDiv && typeof Plotly !== 'undefined' && plotDiv._fullLayout) {
                Plotly.relayout(plotDiv, { autosize: true });
            }
        });
    }, 100);
}

function initializePageScript(pageId) {
    let currentPlots = [];
    switch (pageId) {
        case 'derivative': initDerivativePlot(); initDerivativeChallengePlot(); initMVTPlot(); currentPlots = ['derivative-plot', 'deriv-challenge-plot', 'mvt-plot']; break;
        case 'limits': initLimitsPlot(); currentPlots = ['limit-plot']; break;
        case 'differential': initDifferentialPlot(); initTaylorPlot(); currentPlots = ['differential-plot', 'taylor-plot']; break;
        case 'integral': initIntegralPlot(); initMVTIPlot(); currentPlots = ['integral-plot', 'mvti-plot']; break;
        case 'equation-solver': initEquationSolver(); break;
        case 'polyfit': initPolyfit(); break;
        case 'calculator': setupCalculator(); break;
        case 'precision-calc': initPrecisionCalculator(); break;
    }
    relayoutPlots(currentPlots);
}

async function loadPage(pageUrl) {
    try {
        const pageId = pageUrl.split('.')[0];
        
        // [Optimization] Preload required libraries BEFORE fetching HTML content
        await loadRequiredLibraries(pageId);

        const response = await fetch(pageUrl);
        if (!response.ok) throw new Error(`无法加载页面: ${response.status} ${response.statusText}`);
        const content = await response.text();
        
        contentContainer.innerHTML = content;
        
        renderAllKatex();
        initializePageScript(pageId);
    } catch (error) {
        contentContainer.innerHTML = `<p style="text-align: center; color: var(--secondary-color);">加载页面内容失败: ${error.message}</p>`;
        console.error('Fetch error:', error);
    }
}


// --- 4. Event Listeners & Entry Point ---

document.addEventListener('DOMContentLoaded', () => {
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const navLinks = document.querySelectorAll('nav a');

    hamburgerBtn.addEventListener('click', () => document.body.classList.toggle('sidebar-open'));
    sidebarOverlay.addEventListener('click', () => document.body.classList.remove('sidebar-open'));

    navLinks.forEach(link => {
        link.addEventListener('click', event => {
            event.preventDefault();
            const pageUrl = link.getAttribute('href');
            navLinks.forEach(l => l.classList.remove('active-tab'));
            link.classList.add('active-tab');
            loadPage(pageUrl);
            const pageId = pageUrl.split('.')[0];
            history.pushState({ path: pageUrl }, '', `#${pageId}`);
            document.body.classList.remove('sidebar-open');
        });
    });

    const handleInitialLoad = () => {
        let initialPage = 'derivative.html';
        const hash = window.location.hash.substring(1);
        if (hash) {
            const correspondingLink = document.getElementById(`tab-${hash}`);
            if (correspondingLink) initialPage = correspondingLink.getAttribute('href');
        }
        loadPage(initialPage);
        navLinks.forEach(l => l.classList.remove('active-tab'));
        const initialLinkId = `tab-${initialPage.split('.')[0]}`;
        document.getElementById(initialLinkId)?.classList.add('active-tab');
    };

    handleInitialLoad();
    window.addEventListener('popstate', handleInitialLoad);
    renderAllKatex();
});

// =================================================================
// --- Equation Solver Module ---
// =================================================================
const EquationSolvers = {
    TOLERANCE: 1e-9,
    solveLinear: (a, b) => {
        if (Math.abs(a) < EquationSolvers.TOLERANCE) return [];
        return [{ real: -b / a, imag: 0 }];
    },
    solveQuadratic: (a, b, c) => {
        if (Math.abs(a) < EquationSolvers.TOLERANCE) return EquationSolvers.solveLinear(b, c);
        const delta = b * b - 4 * a * c;
        if (delta >= 0) {
            const sqrtDelta = Math.sqrt(delta);
            return [
                { real: (-b + sqrtDelta) / (2 * a), imag: 0 },
                { real: (-b - sqrtDelta) / (2 * a), imag: 0 }
            ];
        } else {
            const sqrtDeltaAbs = Math.sqrt(-delta);
            return [
                { real: -b / (2 * a), imag: sqrtDeltaAbs / (2 * a) },
                { real: -b / (2 * a), imag: -sqrtDeltaAbs / (2 * a) }
            ];
        }
    },
    solveCubic: (a, b, c, d) => {
        if (Math.abs(a) < EquationSolvers.TOLERANCE) return EquationSolvers.solveQuadratic(b, c, d);
        b /= a; c /= a; d /= a;
        const p = (3 * c - b * b) / 3;
        const q = (2 * b * b * b - 9 * b * c + 27 * d) / 27;
        const delta = (q / 2) ** 2 + (p / 3) ** 3;
        let roots;
        if (delta >= 0) {
            const sqrtDelta = Math.sqrt(delta);
            const u = Math.cbrt(-q / 2 + sqrtDelta);
            const v = Math.cbrt(-q / 2 - sqrtDelta);
            roots = [
                { real: u + v, imag: 0 },
                { real: -(u + v) / 2, imag: (u - v) * Math.sqrt(3) / 2 },
                { real: -(u + v) / 2, imag: -(u - v) * Math.sqrt(3) / 2 }
            ];
        } else {
            const rho = Math.sqrt(-(p ** 3) / 27);
            const theta = Math.acos(-q / (2 * rho));
            const term = 2 * Math.cbrt(rho);
            roots = [
                { real: term * Math.cos(theta / 3), imag: 0 },
                { real: term * Math.cos((theta + 2 * Math.PI) / 3), imag: 0 },
                { real: term * Math.cos((theta + 4 * Math.PI) / 3), imag: 0 }
            ];
        }
        return roots.map(root => ({ real: root.real - b / 3, imag: root.imag }));
    },
    solveQuartic: (a, b, c, d, e) => {
        if (Math.abs(a) < EquationSolvers.TOLERANCE) return EquationSolvers.solveCubic(b, c, d, e);
        b /= a; c /= a; d /= a; e /= a;
        const p = c - (3 * b * b) / 8;
        const q = d + (b ** 3) / 8 - (b * c) / 2;
        const r = e - (3 * b ** 4) / 256 + (b * b * c) / 16 - (b * d) / 4;
        const cubicRoots = EquationSolvers.solveCubic(1, -p, -4 * r, 4 * p * r - q * q);
        const y = cubicRoots.find(root => Math.abs(root.imag) < EquationSolvers.TOLERANCE).real;
        const m = Math.sqrt(y - p);
        const n = Math.abs(m) > EquationSolvers.TOLERANCE ? q / (2 * m) : 0;
        const roots1 = EquationSolvers.solveQuadratic(1, m, y / 2 - n);
        const roots2 = EquationSolvers.solveQuadratic(1, -m, y / 2 + n);
        return roots1.concat(roots2).map(root => ({ real: root.real - b / 4, imag: root.imag }));
    }
};

const EquationFormatter = {
    gcd: (a, b) => b === 0 ? a : EquationFormatter.gcd(b, a % b),
    formatNumber: (n) => {
        if (Math.abs(n) < EquationSolvers.TOLERANCE) return "0";
        if (Math.abs(n - Math.round(n)) < EquationSolvers.TOLERANCE) return n.toFixed(0);
        const isNegative = n < 0;
        n = Math.abs(n);
        const d = 10000;
        const num = Math.round(n * d), den = d;
        const commonDivisor = EquationFormatter.gcd(num, den);
        const simplifiedNum = num / commonDivisor, simplifiedDen = den / commonDivisor;
        if (simplifiedDen === 1) return (isNegative ? "-" : "") + simplifiedNum;
        return (isNegative ? "-" : "") + `\\frac{${simplifiedNum}}{${simplifiedDen}}`;
    },
    formatRoot: (root) => {
        if (Math.abs(root.imag) < EquationSolvers.TOLERANCE) {
            return EquationFormatter.formatNumber(root.real);
        }
        const realPart = EquationFormatter.formatNumber(root.real);
        const imagPart = EquationFormatter.formatNumber(Math.abs(root.imag));
        if (realPart === "0") {
            if (imagPart === "1") return (root.imag < 0 ? "-" : "") + "i";
            return (root.imag < 0 ? "-" : "") + imagPart + "i";
        }
        if (imagPart === "1") return `${realPart} ${root.imag < 0 ? "-" : "+"} i`;
        return `${realPart} ${root.imag < 0 ? "-" : "+"} ${imagPart}i`;
    }
};

function initEquationSolver() {
    const degreeSelector = document.getElementById('equation-degree');
    const inputsContainer = document.getElementById('coefficient-inputs');
    const solveBtn = document.getElementById('solve-equation-btn');
    const resultsDiv = document.getElementById('solver-results');
    function renderInputs() {
        const degree = parseInt(degreeSelector.value);
        inputsContainer.innerHTML = '';
        const coeffs = ['a', 'b', 'c', 'd', 'e'];
        const powers = ['x^4', 'x^3', 'x^2', 'x', ''];
        let html = '';
        for (let i = 0; i <= degree; i++) {
            const powerIndex = 4 - degree + i;
            html += `
                <label for="coeff-${coeffs[i]}">${coeffs[i]}=</label>
                <input type="number" id="coeff-${coeffs[i]}" value="${i === 0 ? 1 : 0}"> 
                ${powers[powerIndex] ? `<span>${powers[powerIndex]}</span>` : ''}
                ${i < degree ? '<span style="font-weight:bold; margin: 0 5px;">+</span>' : ''}
            `;
        }
        html += '<span style="font-weight:bold; margin: 0 5px;">= 0</span>';
        inputsContainer.innerHTML = html;
    }
    function solve() {
        const degree = parseInt(degreeSelector.value);
        const coeffs = ['a', 'b', 'c', 'd', 'e'].slice(0, degree + 1)
            .map(c => parseFloat(document.getElementById(`coeff-${c}`).value));
        if (coeffs.some(isNaN)) {
            resultsDiv.innerHTML = '<p style="color:red;">错误：所有系数都必须是数字。</p>';
            return;
        }
        if (Math.abs(coeffs[0]) < EquationSolvers.TOLERANCE) {
            resultsDiv.innerHTML = '<p style="color:red;">错误：最高次项系数 a 不能为 0。</p>';
            return;
        }
        const solverFn = [null, EquationSolvers.solveLinear, EquationSolvers.solveQuadratic, EquationSolvers.solveCubic, EquationSolvers.solveQuartic][degree];
        const solutions = solverFn(...coeffs);
        const uniqueSolutions = [];
        solutions.forEach(sol => {
            if (!uniqueSolutions.some(usol => Math.abs(usol.real - sol.real) < EquationSolvers.TOLERANCE && Math.abs(usol.imag - sol.imag) < EquationSolvers.TOLERANCE)) {
                uniqueSolutions.push(sol);
            }
        });
        if (uniqueSolutions.length === 0) {
            resultsDiv.textContent = "无解或所有系数均为0.";
            return;
        }
        const latexString = uniqueSolutions.map((root, i) => `x_{${i + 1}} = ${EquationFormatter.formatRoot(root)}`).join('\\\\');
        resultsDiv.innerHTML = `<div class="katex-render" data-katex="${latexString}"></div>`;
        renderAllKatex();
    }
    degreeSelector.addEventListener('change', renderInputs);
    solveBtn.addEventListener('click', solve);
    renderInputs();
}

// =================================================================
// --- Other Modules Initialization (Plots) ---
// =================================================================

function initDerivativePlot() {
    const plotDiv=document.getElementById('derivative-plot'),xSlider=document.getElementById('point-x'),xDisplay=document.getElementById('x-value-display');const updatePlot=()=>{const t=parseFloat(xSlider.value);xDisplay.textContent=`x = ${t.toFixed(1)}`;const o=f_deriv(t),e=fPrime_deriv(t),n=.5,l=t+n,a=f_deriv(l),d={x:x_vals_default,y:y_vals_deriv,mode:'lines',name:'y=0.5x²+1',line:{color:'rgba(0,0,170,0.8)',width:3}},r={x:[t],y:[o],mode:'markers',name:`P(${t.toFixed(1)},${o.toFixed(1)})`,marker:{size:10,color:'var(--secondary-color)'}},i=[-6,6],s=i.map(e=>o+e*(e-t)),c={x:i,y:s,mode:'lines',name:'切线',line:{color:'var(--secondary-color)',dash:'dash',width:2}},p=[t,l],u=[o,a],m={x:p,y:u,mode:'lines',name:`割线(h=${n})`,line:{color:'rgba(0,150,0,0.6)',width:1.5}},f={title:`f'(${t.toFixed(1)})=${e.toFixed(1)}`,xaxis:{title:'x',range:[-5,5]},yaxis:{title:'y',range:[0,15],scaleanchor:"x",scaleratio:1},hovermode:'closest',margin:{l:50,r:50,t:50,b:50},autosize:!0};Plotly.newPlot(plotDiv,[d,r,m,c],f,{responsive:!0})};xSlider.addEventListener('input',updatePlot),updatePlot()}
function initMVTPlot() {
    const t=document.getElementById("mvt-plot"),e=document.getElementById("mvt-a"),a=document.getElementById("mvt-b"),o=document.getElementById("mvt-a-display"),n=document.getElementById("mvt-b-display"),l=Array.from({length:101},(t,e)=>-4+.08*e),d=l.map(f_mvt);const i=()=>{const r=parseFloat(e.value),s=parseFloat(a.value);o.textContent=`a = ${r.toFixed(1)}`,n.textContent=`b = ${s.toFixed(1)}`;const c=f_mvt(r),p=f_mvt(s),u=(p-c)/(s-r),m=144-12*-u;let f=null;if(m>=0){const t=(12+Math.sqrt(m))/6,e=(12-Math.sqrt(m))/6;t>r&&t<s?f=t:e>r&&e<s&&(f=e)}const g={x:l,y:d,mode:"lines",name:"函数 f(x)",line:{color:"rgba(0, 0, 170, 0.8)",width:3}},x={x:[r,s],y:[c,p],mode:"lines",name:"割线",line:{color:"rgba(0, 150, 0, 0.8)",width:2}};let v=[g,x];let y=`微分中值定理: 割线斜率 = ${u.toFixed(2)}`;if(null!==f){const t=f_mvt(f),e=[-4,4],a=e.map(e=>t+u*(e-f)),o={x:e,y:a,mode:"lines",name:"平行切线 (c)",line:{color:"var(--secondary-color)",dash:"dash",width:2}},n={x:[f],y:[t],mode:"markers",name:`C (${f.toFixed(2)})`,marker:{size:10,color:"var(--secondary-color)"}};v.push(o,n),y+=`，找到 C 点: ${f.toFixed(2)}`}const h={title:y,xaxis:{title:"x 轴",range:[-4.5,4.5]},yaxis:{title:"y 轴",range:[-30,15]},autosize:!0};Plotly.newPlot(t,v,h,{responsive:!0})};e.addEventListener("input",i),a.addEventListener("input",i),i()}
function initDerivativeChallengePlot() {
    Plotly.newPlot('deriv-challenge-plot',[{x:Array.from({length:101},(t,e)=>-.5+3*e/100),y:Array.from({length:101},(t,e)=>Math.sin(-.5+3*e/100)),mode:'lines',name:'y = sin(x)',line:{color:'blue'}},{x:[-1.5,1.5],y:[-1.5,1.5],mode:'lines',name:'y = x',line:{color:'orange',dash:'dash'}}],{title:'洛必达法则几何意义：y=sin(x) 与 y=x 在原点附近',xaxis:{range:[-1.5,1.5]},yaxis:{range:[-1.5,1.5],scaleanchor:"x",scaleratio:1},autosize:true},{responsive:true})}
function initLimitsPlot() {
    const t=document.getElementById("limit-plot"),e=document.getElementById("epsilon-slider"),o=document.getElementById("epsilon-display"),a=document.getElementById("delta-display"),n=t=>t*t-t+2,l=2,d=4,i=t=>{if(9-4*t<0)return 0;const e=Math.sqrt(9+4*t),o=Math.sqrt(9-4*t);return Math.min((1+e)/2-l,l-(1+o)/2)};const s=()=>{const r=parseFloat(e.value);o.textContent=`ε = ${r.toFixed(2)}`;const c=i(r);a.textContent=`对于给定的 ε, 找到的 δ ≈ ${c.toFixed(3)}`;const p=Array.from({length:201},(t,e)=>l-2+.02*e),u=p.map(n),m=[];m.push({x:p,y:u,mode:"lines",name:"f(x)",line:{color:"var(--primary-color)",width:3}}),m.push({x:[l-2,l+2],y:[d+r,d+r],mode:"lines",line:{color:"rgba(204,0,0,0.4)",dash:"dash"}}),m.push({x:[l-2,l+2],y:[d-r,d-r],mode:"lines",line:{color:"rgba(204,0,0,0.4)",dash:"dash"},fill:"tonexty",fillcolor:"rgba(255, 204, 204, 0.3)"}),c>0&&(m.push({x:[l-c,l-c],y:[0,8],mode:"lines",line:{color:"rgba(0,0,204,0.4)",dash:"dash"}}),m.push({x:[l+c,l+c],y:[0,8],mode:"lines",line:{color:"rgba(0,0,204,0.4)",dash:"dash"},fill:"tonexty",fillcolor:"rgba(204, 204, 255, 0.3)"})),m.push({x:[l],y:[d],mode:"markers",name:`(c, L) = (${l}, ${d})`,marker:{size:12,color:"var(--secondary-color)"}});const f={title:`ε-δ 定义: |x-2|<${c.toFixed(3)} ⇒ |f(x)-4|<${r.toFixed(2)}`,xaxis:{title:"x 轴",range:[l-1.5,l+1.5]},yaxis:{title:"y 轴",range:[d-2.5,d+2.5]},showlegend:!1};Plotly.newPlot(t,m,f,{responsive:!0})};e.addEventListener("input",s),s()}
function initDifferentialPlot() {
    const t=document.getElementById("differential-plot"),e=document.getElementById("delta-x"),o=document.getElementById("dx-value-display"),l=1,a=f_deriv(l),n=fPrime_deriv(l);const d=()=>{const i=parseFloat(e.value);o.textContent=`dx = ${i.toFixed(1)}`;const r=l+i,s=f_deriv(r),c=a+n*i,p=s-a,u=c-a,m={x:x_vals_default,y:y_vals_deriv,mode:"lines",name:"函数 f(x)",line:{color:"rgba(0, 0, 170, 0.8)",width:3}},f=[l-2,l+i+.5],g=f.map(t=>a+n*(t-l)),x={x:f,y:g,mode:"lines",name:"切线",line:{color:"var(--primary-color)",dash:"dot",width:2}},v={x:[r,r],y:[c,s],mode:"lines",name:`Δy - dy (误差) = ${(p-u).toFixed(3)}`,line:{color:"var(--secondary-color)",width:3}},y={x:[r,r],y:[a,c],mode:"lines",name:`dy (微分) = ${u.toFixed(2)}`,line:{color:"rgba(0, 150, 0, 0.8)",width:3,dash:"dash"}},h={x:[l,r],y:[a,s],mode:"markers",name:"P, Q",marker:{size:10,color:"black"}},w={title:`微分线性近似 (dx=${i.toFixed(1)}), Δy≈dy`,xaxis:{title:"x 轴",range:[-1,5]},yaxis:{title:"y 轴",range:[0,8],scaleanchor:"x",scaleratio:1},hovermode:"closest",margin:{l:50,r:50,t:50,b:50},autosize:!0};Plotly.newPlot(t,[m,x,y,v,h],w,{responsive:!0})};e.addEventListener("input",d),d()}
function initTaylorPlot() {
    const t=document.getElementById("taylor-plot"),e=document.getElementById("taylor-n"),o=document.getElementById("taylor-n-display"),a=Array.from({length:201},(t,e)=>-5+.05*e),n=a.map(f_taylor);const l=()=>{const d=parseInt(e.value);o.textContent=`n = ${d} (${d}阶)`;const i=a.map(t=>taylorPolynomial(t,d)),r={x:a,y:n,mode:"lines",name:"f(x) = sin(x)",line:{color:"var(--secondary-color)",width:3}},s={x:a,y:i,mode:"lines",name:`P${d}(x) 泰勒多项式`,line:{color:"var(--primary-color)",dash:"dot",width:2}},c={title:`泰勒多项式近似 f(x)=sin(x) (n=${d})`,xaxis:{title:"x 轴",range:[-5,5]},yaxis:{title:"y 轴",range:[-2,2]},autosize:!0};Plotly.newPlot(t,[r,s],c,{responsive:!0})};e.addEventListener("input",l),l()}
function initIntegralPlot() {
    const t=document.getElementById("integral-plot"),e=document.getElementById("num-rectangles"),o=document.getElementById("n-value-display"),a=Array.from({length:101},(t,e)=>integral_a-1+(integral_b-integral_a+2)*e/100),n=a.map(f_integral);const l=()=>{const d=parseInt(e.value);o.textContent=`n = ${d}`;const i=(integral_b-integral_a)/d;let r=0;const s=[],c=[];for(let t=0;t<d;t++){const e=integral_a+t*i,o=integral_a+(t+1)*i,a=f_integral(e+i/2);s.push(e,e,o,o,e),c.push(0,a,a,0,0),r+=a*i}const p={x:s,y:c,type:"scatter",fill:"toself",mode:"lines",name:`黎曼和 (n=${d})`,fillcolor:"rgba(173, 216, 230, 0.7)",line:{color:"rgba(0, 0, 0, 0.4)",width:.5}},u={x:a,y:n,mode:"lines",name:"函数 f(x)",line:{color:"var(--secondary-color)",width:3}},m={title:`定积分 (面积) 近似 (n=${d}, 近似值: ${r.toFixed(3)})`,xaxis:{title:"x 轴",range:[integral_a-1,integral_b+1]},yaxis:{title:"y 轴",range:[0,6]},margin:{l:50,r:50,t:50,b:50},showlegend:!1,autosize:!0};Plotly.newPlot(t,[p,u],m,{responsive:!0})};e.addEventListener("input",l),l()}
function initMVTIPlot() {
    const t=document.getElementById("mvti-plot"),e=1,o=4,a=Array.from({length:101},(t,e)=>0+.06*e),n=a.map(f_integral),l=t=>2*t+4/Math.PI*Math.sin(Math.PI*t/4),d=l(o)-l(e),i=d/(o-e);const r={x:a,y:n,mode:"lines",name:"函数 f(x)",line:{color:"var(--secondary-color)",width:3}},s={x:[e,o],y:[i,i],mode:"lines",name:"平均值",line:{color:"var(--primary-color)",dash:"dot",width:2}},c={x:[e,e,o,o,e],y:[0,i,i,0,0],fill:"toself",type:"scatter",mode:"lines",fillcolor:"rgba(0, 150, 0, 0.4)",name:"平均值矩形"},p={title:`积分中值定理演示 (f_avg = ${i.toFixed(3)})`,xaxis:{title:"x 轴",range:[0,5]},yaxis:{title:"y 轴",range:[0,4]},showlegend:!1,autosize:!0};document.getElementById("mvti-avg-display").textContent=`f_avg: ${i.toFixed(3)}`,Plotly.newPlot(t,[c,r,s],p,{responsive:!0})}
function initPolyfit() {
    const t=document.getElementById("polyfit-terms"),e=document.getElementById("polyfit-instruction"),o=Array.from({length:6},(t,e)=>document.getElementById(`poly-a${e+1}`)),a=Array.from({length:6},(t,e)=>document.getElementById(`wrapper-a${e+1}`));const n=()=>{const o=parseInt(t.value);a.forEach((t,e)=>{t.style.display=e<o?"block":"none"});const n=Array.from({length:o},(t,e)=>`a_{${e+1}}`).join(", ");e.innerHTML=`请输入数列的前 ${o} 项 (<span data-latex-inline="${n}"></span>):`,renderAllKatex(),calculatePolyfit()};t.addEventListener("change",n),o.forEach(t=>t.addEventListener("input",calculatePolyfit)),n()}
function generalizedInterpolate(t){const e=t.length;if(e<2)return{formula:"a_n = "+(t[0]||"..."),polynomialFn:e=>t[0]||0};const o=t.map((t,e)=>({x:e+1,y:t})),a=o.map(t=>t.y);for(let t=1;t<e;t++)for(let n=e-1;n>=t;n--)a[n]=(a[n]-a[n-1])/(o[n].x-o[n-t].x);const n=t=>{let e=a[0],n=1;for(let l=1;l<o.length;l++)n*=t-o[l-1].x,e+=n*a[l];return e};let l="a_n = "+a[0].toFixed(3);for(let t=1;t<e;t++){const e=a[t];if(Math.abs(e)<1e-9)continue;l+=(e>0?" + ":" - ")+Math.abs(e).toFixed(3);for(let o=0;o<t;o++)l+=`(n - ${o+1})`}return{formula:l,polynomialFn:n}}
window.calculatePolyfit=function(){const t=parseInt(document.getElementById("polyfit-terms").value),e=[];for(let o=1;o<=t;o++){const t=parseFloat(document.getElementById(`poly-a${o}`).value);if(isNaN(t))return void(document.getElementById("polyfitFormulaOutput").textContent="请确保所有输入均为数字。");e.push(t)}const o=generalizedInterpolate(e);katex.render(o.formula,document.getElementById("polyfitFormulaOutput"),{throwOnError:!1,displayMode:!0,trust:!0});const a=[];for(let n=1;n<=5;n++)a.push(Math.round(o.polynomialFn(t+n)));const n=`a_${t+1} 至 a_${t+5}：${a.join(", ")}`;document.getElementById("polyfitPredictionsOutput").textContent=n};

function setupCalculator() {
    const calcDisplay = document.getElementById('calc-display');
    let currentInput = '0', previousInput = '', operator = null, waitingForSecondOperand = false;
    const safeEval = expr => { try { return Function('return ' + expr)(); } catch (e) { return 'Error'; }};
    const performCalculation = (op, first, second) => {
        first = parseFloat(first); second = parseFloat(second);
        if (op === '+') return first + second; if (op === '-') return first - second;
        if (op === '*') return first * second; if (op === '/') return second === 0 ? 'Error: Div by 0' : first / second;
        if (op === '%') return first % second; if (op === 'power_y') return Math.pow(first, second);
        return second;
    };
    const handleFunction = func => {
        const value = parseFloat(currentInput); let result;
        if(isNaN(value)) { currentInput = 'Error'; updateDisplay(); return; }
        switch(func) {
            case 'sqrt': result = Math.sqrt(value); break;
            case 'sin': result = Math.sin(value); break;
            case 'cos': result = Math.cos(value); break;
            case 'tan': result = Math.tan(value); break;
            case 'log': result = Math.log(value); break;
            case 'exp': result = Math.exp(value); break;
            case 'power_2': result = Math.pow(value, 2); break;
            case 'factorial':
                if (value < 0 || value % 1 !== 0 || value > 170) result = 'Error';
                else { let res = 1; for (let i = 2; i <= value; i++) res *= i; result = res; }
                break;
            default: return;
        }
        currentInput = result.toString().includes('Error') ? result.toString() : parseFloat(result.toPrecision(12)).toString();
        updateDisplay();
    };
    const updateDisplay = () => { calcDisplay.textContent = currentInput; };
    const handleButtonClick = button => {
        const value = button.getAttribute('data-value'), op = button.getAttribute('data-op'), clear = button.getAttribute('data-clear'), func = button.getAttribute('data-function');
        if (value && (value.match(/[0-9.]/) || value.startsWith('Math'))) {
            if(value.startsWith('Math')) { currentInput = safeEval(value).toPrecision(12); }
            else if (waitingForSecondOperand) { currentInput = value === '.' ? '0.' : value; waitingForSecondOperand = false; }
            else { if (currentInput === '0' && value !== '.') currentInput = value; else if (!(value === '.' && currentInput.includes('.'))) currentInput += value; }
        }
        if (clear) { if (clear === 'all') { currentInput = '0'; previousInput = ''; operator = null; } else if (clear === 'entry') { currentInput = '0'; } }
        if (func) { if (func === 'power_y') handleOperator(func); else handleFunction(func); }
        if (op) handleOperator(op);
        updateDisplay();
    };
    const handleOperator = nextOperator => {
        const inputValue = parseFloat(currentInput);
        if (operator && waitingForSecondOperand) { operator = nextOperator; return; }
        if (previousInput === '') { previousInput = inputValue; }
        else if (operator) {
            const result = performCalculation(operator, previousInput, inputValue);
            currentInput = result.toString().includes('Error') ? result.toString() : parseFloat(result.toPrecision(12)).toString();
            previousInput = parseFloat(currentInput);
        }
        waitingForSecondOperand = true;
        operator = nextOperator === '=' ? null : nextOperator;
    };
    document.querySelectorAll('.calculator-grid button').forEach(button => { button.onclick = () => handleButtonClick(button); });
    updateDisplay();
}

// [UX Update] Precision Calculator with Loading State
function initPrecisionCalculator() {
    const precisionInput = document.getElementById('precision-digits');
    const sqrtInput = document.getElementById('sqrt-input');
    const outputArea = document.getElementById('precision-output');
    const statusDiv = document.getElementById('precision-status');
    
    const setStatus = (message, isError = false) => {
        statusDiv.textContent = message;
        statusDiv.style.color = isError ? 'var(--secondary-color)' : 'var(--theorem-color)';
    };
    
    const calculate = async (task, value) => {
        const digits = parseInt(precisionInput.value);
        let max_digits = 15000;
        let error_msg = `错误：精度必须在 10 到 ${max_digits} 之间。`;
        
        if (task === 'pi' || task === 'e') { 
            max_digits = 2000; 
            error_msg = `错误：计算 ${task} 的精度必须在 10 到 ${max_digits} 之间。`; 
        }
        
        if (isNaN(digits) || digits < 10 || digits > max_digits) { 
            setStatus(error_msg, true); 
            return; 
        }

        // 1. Lock UI and set cursor to wait
        const buttons = document.querySelectorAll('.precision-button');
        buttons.forEach(btn => btn.disabled = true);
        document.body.style.cursor = 'wait';
        
        setStatus('正在计算中，请稍候... (高精度计算可能会卡顿几秒)', false);
        outputArea.value = 'Calculating...';
        
        // 2. Use setTimeout to allow UI to update before blocking calculation starts
        setTimeout(async () => {
            try {
                const startTime = performance.now();
                BigNumber.config({ DECIMAL_PLACES: digits + 5, POW_PRECISION: digits + 5 });
                
                let result = '';
                if (task === 'sqrt') {
                    const num = parseInt(value);
                    if (isNaN(num) || num <= 0 || num > 10000) throw new Error('开方数必须是 1 到 10,000 之间的正数。');
                    result = await highPrecisionSqrt(num, digits);
                } else if (task === 'pi') result = await highPrecisionPi(digits);
                else if (task === 'e') result = await highPrecisionE(digits);
                else if (task === 'phi') result = await highPrecisionPhi(digits);
                
                const duration = ((performance.now() - startTime) / 1000).toFixed(2);
                outputArea.value = result;
                setStatus(`计算完成！耗时 ${duration} 秒。`, false);
            } catch (e) {
                setStatus(`计算出错: ${e.message}`, true);
                outputArea.value = 'Error.';
            } finally {
                // 3. Unlock UI and restore cursor
                buttons.forEach(btn => btn.disabled = false);
                document.body.style.cursor = 'default';
            }
        }, 50);
    };

    document.getElementById('calc-sqrt-btn').onclick = () => calculate('sqrt', sqrtInput.value);
    document.getElementById('calc-pi-btn').onclick = () => calculate('pi');
    document.getElementById('calc-e-btn').onclick = () => calculate('e');
    document.getElementById('calc-phi-btn').onclick = () => calculate('phi');
    
    document.getElementById('download-result-btn').onclick = () => {
        const text = outputArea.value;
        if (!text || text.startsWith('请选择') || text.startsWith('Calculating')) { 
            setStatus('没有可下载的结果。', true); 
            return; 
        }
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `high_precision_result.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
}

async function highPrecisionSqrt(number, precision) {
    BigNumber.config({ DECIMAL_PLACES: precision + 5 });
    const S = new BigNumber(number);
    let x = new BigNumber(Math.sqrt(number));
    const limit = new BigNumber(1).shiftedBy(-precision - 2);
    while (true) {
        let next_x = x.plus(S.div(x)).div(2);
        if (x.minus(next_x).abs().lt(limit)) break;
        x = next_x;
    }
    return x.toFixed(precision);
}
async function highPrecisionPi(precision) {
    BigNumber.config({ DECIMAL_PLACES: precision + 5 });
    let a = new BigNumber(1), b = new BigNumber(1).div(new BigNumber(2).sqrt()), t = new BigNumber(0.25), p = new BigNumber(1);
    for (let i = 0; i < Math.ceil(Math.log2(precision)); i++) {
        let a_next = a.plus(b).div(2);
        let b_next = a.times(b).sqrt();
        t = t.minus(p.times(a.minus(a_next).pow(2)));
        a = a_next; b = b_next; p = p.times(2);
    }
    const pi = a.plus(b).pow(2).div(t.times(4));
    return pi.toFixed(precision);
}
async function highPrecisionE(precision) {
    BigNumber.config({ DECIMAL_PLACES: precision + 5 });
    let e = new BigNumber(1), factorial = new BigNumber(1);
    for (let i = 1; i < precision * 2; i++) {
        factorial = factorial.times(i);
        const term = new BigNumber(1).div(factorial);
        if (term.abs().lt(new BigNumber(1).shiftedBy(-precision - 3))) break;
        e = e.plus(term);
    }
    return e.toFixed(precision);
}
async function highPrecisionPhi(precision) {
    BigNumber.config({ DECIMAL_PLACES: precision + 5 });
    const sqrt5 = await highPrecisionSqrt(5, precision + 5);
    const phi = new BigNumber(1).plus(sqrt5).div(2);
    return phi.toFixed(precision);
}
