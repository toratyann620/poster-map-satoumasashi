import puppeteer from 'puppeteer';

const KEYS = {
    FIREBASE: 'AIzaSyDFVt8w4WjvR7U5xJRCA7-_2FY40hIlWdk',
    MAPS: 'AIzaSyDXp9b70XVMx_7HsGBSTgneY41ceO0MCR4'
};
const MAP_IDS = {
    USER_RASTER: '46b8813d0839a93d152e1d01',
    DEMO: 'DEMO_MAP_ID'
};

async function testCombo(keyName, key, mapIdName, mapId) {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    let tileSuccess = false;
    let tileFail = false;
    let errorMessage = '';

    page.on('response', response => {
        const url = response.url();
        if (url.includes('maps/vt/pb') || url.includes('maps/vt/icon') || url.includes('maps/api/js/ViewportInfoService')) {
            if (response.status() === 200) {
                tileSuccess = true;
            } else {
                tileFail = true;
                errorMessage = `Status ${response.status()}`;
                console.log(`[!] Failed req to ${url} with ${response.status()}`);
            }
        }
    });

    const html = `
        <!DOCTYPE html><html><body><div id="map" style="width:500px;height:500px;"></div>
        <script>
            (g=>{var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window;b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,u=()=>h||(h=new Promise(async(f,n)=>{await (a=m.createElement("script"));e.set("libraries",[...r]+"");for(k in g)e.set(k.replace(/[A-Z]/g,t=>"_"+t[0].toLowerCase()),g[k]);e.set("callback",c+".maps."+q);a.src=\`https://maps.\${c}apis.com/maps/api/js?\`+e;d[q]=f;a.onerror=()=>h=n(Error(p+" could not load."));a.nonce=m.querySelector("script[nonce]")?.nonce||"";m.head.append(a)}));d[l]?console.warn(p+" only loads once. Ignoring:",g):d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))})({
                key: "${key}",
                v: "weekly"
            });
            async function initMap() {
                try {
                    const { Map, RenderingType } = await google.maps.importLibrary("maps");
                    const map = new Map(document.getElementById("map"), {
                        center: { lat: 35.681167, lng: 139.767052 },
                        zoom: 14,
                        mapId: "${mapId}",
                        renderingType: RenderingType.RASTER
                    });
                } catch(e) {
                    console.log("[ERROR INSIDE BROWSER] " + e.message);
                }
            }
            initMap();
        </script>
        </body></html>
    `;

    page.on('console', msg => {
        if (msg.text().includes('ERROR INSIDE BROWSER') || msg.text().includes('ApiNotActivatedMapError') || msg.text().includes('InvalidKeyMapError') || msg.text().includes('Map ID')) {
            console.log(`[Browser Console] ${msg.text()}`);
            errorMessage += ` | ${msg.text()}`;
        }
    });

    await page.setContent(html);
    await new Promise(r => setTimeout(r, 4000)); // wait 4 seconds
    await browser.close();

    console.log(`[Result] Key=${keyName}, MapId=${mapIdName} -> TilesLoaded: ${tileSuccess}, ErrReq: ${tileFail} ${errorMessage}`);
    console.log('--------------------------------------------');
}

(async () => {
    console.log('=== Checking Key & Map ID Combinations ===');
    await testCombo('FIREBASE_KEY', KEYS.FIREBASE, 'USER_RASTER', MAP_IDS.USER_RASTER);
    await testCombo('MAPS_KEY_OLD', KEYS.MAPS, 'USER_RASTER', MAP_IDS.USER_RASTER);
    await testCombo('FIREBASE_KEY', KEYS.FIREBASE, 'DEMO_MAP_ID', MAP_IDS.DEMO);
    await testCombo('MAPS_KEY_OLD', KEYS.MAPS, 'DEMO_MAP_ID', MAP_IDS.DEMO);
    console.log('=== Done ===');
})();
