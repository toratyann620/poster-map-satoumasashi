import fs from 'fs';
import https from 'https';
import { v4 as uuidv4 } from 'uuid';

const API_KEY = "AIzaSyDXp9b70XVMx_7HsGBSTgneY41ceO0MCR4";

const rawData = `種類	所在地	設置	枚数	備考	特記事項
佐藤まさし	神奈川県厚木市上依知261-1	針金	2	駐車場	
佐藤まさし	神奈川県厚木市上依知52-21	フェンス	1		
佐藤まさし	神奈川県厚木市上依知23-2	壁掛け	1		
佐藤まさし	神奈川県厚木市上依知2684	針金	2	駐車場	
佐藤まさし	神奈川県厚木市上依知2397付近	杭打ち	1	畑	
佐藤まさし	神奈川県厚木市上依知61-1	フェンス	2		
佐藤まさし	神奈川県厚木市上依知2565-4	フェンス	1	畑	
佐藤まさし	神奈川県厚木市上依知1378-1	フェンス	1		
佐藤まさし	神奈川県厚木市上依知1753	フェンス	1		
佐藤まさし	神奈川県厚木市上依知1395-21	フェンス	2		
後藤ゆういち	神奈川県厚木市猿ヶ島201	フェンス	2		
後藤ゆういち	神奈川県厚木市猿ヶ島396	杭打ち	1		
後藤ゆういち	神奈川県厚木市山際801-9	針金	1		
後藤ゆういち	神奈川県厚木市山際808	フェンス	1		
後藤ゆういち	神奈川県厚木市山際791	プレハブ	1		
後藤ゆういち	神奈川県厚木市山際669-1	壁掛け	1		
後藤ゆういち	神奈川県厚木市山際678-3	針金	1		
後藤ゆういち	神奈川県厚木市山際689-3	フェンス	1		
後藤ゆういち	神奈川県厚木市山際658付近	杭打ち	2	駐車場	
後藤ゆういち	神奈川県厚木市山際637	杭打ち	1		
後藤ゆういち	神奈川県厚木市山際745-6	フェンス	1	駐車場	
後藤ゆういち	神奈川県厚木市山際558-2	フェンス	1		
後藤ゆういち	神奈川県厚木市山際897-6	フェンス	1		
後藤ゆういち	神奈川県厚木市山際218-2	フェンス	2	駐車場	
後藤ゆういち	神奈川県厚木市山際204付近	フェンス	1	倉庫	
後藤ゆういち	神奈川県厚木市山際396	フェンス	2		`;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const geocode = (address) => {
    return new Promise((resolve, reject) => {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const json = JSON.parse(data);
                if (json.status === 'OK' && json.results.length > 0) {
                    resolve(json.results[0].geometry.location);
                } else {
                    console.warn(`Geocoding failed for ${address}: ${json.status}`);
                    resolve(null);
                }
            });
        }).on('error', reject);
    });
};

async function main() {
    const lines = rawData.trim().split('\n').slice(1);
    const results = [];

    for (const line of lines) {
        const parts = line.split('\t');
        const type = parts[0] === '佐藤まさし' ? 'sato' : 'goto';
        const address = parts[1];
        const placement = parts[2];
        const quantity = parseInt(parts[3] || '1', 10);
        const memo = parts[4] || '';
        const specialNote = parts[5] || '';

        console.log(`Geocoding: ${address}...`);
        let location = await geocode(address);
        if (!location) {
            // Fallback logic if API fails or restricts
            location = { lat: 35.4385, lng: 139.3620 };
        }

        results.push({
            id: uuidv4(),
            type,
            lat: location.lat,
            lng: location.lng,
            address,
            placement,
            quantity,
            memo,
            specialNote,
            tags: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        });

        // throttle
        await sleep(200);
    }

    const outputDir = './src/data';
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }
    fs.writeFileSync('./src/data/sample.json', JSON.stringify(results, null, 2));
    console.log('Sample data generated at ./src/data/sample.json');
}

main().catch(console.error);
