const taos = require("@tdengine/websocket");
const Mock = require("mockjs");
const moment = require("moment-timezone");
const { fetchWeatherApi } = require('openmeteo'); // You'll need to install this

const TDENGINE_HOST = process.env.TDENGINE_HOST || 'localhost';
const TDENGINE_USER = process.env.TDENGINE_USER || 'root';
const TDENGINE_PASS = process.env.TDENGINE_PASS || 'taosdata';
const TDENGINE_DB = process.env.TDENGINE_DB || 'renewables';
const TZ = process.env.TZ || 'America/Los_Angeles';

let dsn = "ws://" + TDENGINE_HOST + ":6041";
const url = 'https://api.open-meteo.com/v1/forecast';

async function createConnect() {
    try {
        let conf = new taos.WSConfig(dsn);
        conf.setUser(TDENGINE_USER);
        conf.setPwd(TDENGINE_PASS);
        conf.setDb(TDENGINE_DB);
        conn = await taos.sqlConnect(conf);
        console.log("Connected to " + dsn + " successfully.");
        return conn;
    } catch (err) {
        console.log("Failed to connect to " + dsn + ", ErrCode: " + err.code + ", ErrMessage: " + err.message);
        throw err;
    }
}

async function createDbAndTable() {
    let wsSql = null;
    try {
        let conf = new taos.WSConfig(dsn);
        conf.setUser(TDENGINE_USER);
        conf.setPwd(TDENGINE_PASS);
        wsSql = await taos.sqlConnect(conf);
        console.log("Connected to " + dsn + " successfully.");

        await wsSql.exec("CREATE DATABASE IF NOT EXISTS renewables");
        console.log("Created database renewables successfully.");

        await wsSql.exec(
            "CREATE STABLE IF NOT EXISTS renewables.solarfarms " +
            "(ts TIMESTAMP, ambienttemperature_c FLOAT, windspeed_mps FLOAT, poweroutput_kw FLOAT, current FLOAT, voltage FLOAT) " +
            "TAGS (panelid BINARY(50), string_id BINARY(50), site BINARY(50));"
        );
        console.log("Created stable renewables.solarfarms successfully");
    } catch (err) {
        console.error(`Failed to create database or stable, ErrCode: ${err.code}, ErrMessage: ${err.message}`);
        throw err;
    } finally {
        if (wsSql) {
            await wsSql.close();
        }
    }
}

async function insertData() {
    let wsSql = await createConnect();

    const SITES = ["solarfarma", "solarfarmb", "solarfarmc"];
    const STRINGS = 10;
    const PANELS = 10;
    const gps = new Map();
    gps.set("solarfarma", "37.041,-120.92");
    gps.set("solarfarmb", "37.61,-121.90");
    gps.set("solarfarmc", "33.71,-115.45");
    const atws = new Map();

    // Initialize weather data
    for (const site of SITES) {
        const [lat, lon] = gps.get(site).split(",");
        const [at, ws] = await getWeather(lat, lon);
        atws.set(site, [at, ws]);
    }

    setInterval(async () => {
        try {
            // Update weather data periodically (e.g., every 5 minutes)
            let rows_inserted = 0;
            const ts = Date.now();
            const mins = new Date(ts).getMinutes();
            if (mins % 5 === 0) {
                for (const site of SITES) {
                    const [lat, lon] = gps.get(site).split(",");
                    const [at, ws] = await getWeather(lat, lon);
                    atws.set(site, [at, ws]);
                    console.log(`Updated weather for ${site}: Temp - ${at}, Wind - ${ws}`);
                }
            }

            for (const site of SITES) {
                for (let s = 0; s < STRINGS; s++) {
                    for (let p = 0; p < PANELS; p++) {
                        //const panelId = `panel${String(p).padStart(2, '0')}`; // Consistent panel IDs
                        const panelId = `panel${p}`; // Consistent panel IDs
                        const stringId = `string${s}`;
                        let tableName = `${site}-${stringId}-${panelId}`;                        
                        const [at, ws] = atws.get(site); // Get weather data
                        const mockData = generateMockData(at, ws);
                        const dateStr = moment().tz(TZ).format("YYYY-MM-DD HH:mm:ss.SSSZ");
                        const insertQuery = `INSERT INTO renewables.\`${tableName}\` USING renewables.solarfarms (panelid, string_id, site) TAGS('${panelId}', '${stringId}', '${site}') ` +
                            `VALUES ('${dateStr}', ${mockData.ambienttemperature_c}, ${mockData.windspeed_mps}, ${mockData.poweroutput_kw}, ${mockData.current}, ${mockData.voltage})`;
                        let taosResult = await wsSql.exec(insertQuery);
                        // console.log(insertQuery);
                        // console.log("Successfully inserted " + taosResult.getAffectRows() + " rows to renewables.solarfarms.");
                        rows_inserted += taosResult.getAffectRows();
                    }
                }
            }
            console.log(`Inserted ${rows_inserted} rows to renewables.solarfarms.`);
        } catch (err) {
            console.error(`Failed to insert data, ErrCode: ${err.code}, ErrMessage: ${err.message}`);
        }
        // queryData();
    }, 10000); // Data every 10 seconds
}

function generateMockData(at, ws) {
    const ts = Date.now();
    const hrs = new Date(ts).getHours();

    const dateStr = moment().tz("America/Los_Angeles").format();
    const windspeedf = parseFloat(ws) + (Mock.Random.float(0, 2));
    const windspeed = parseFloat(windspeedf.toFixed(2));
    const atf = parseFloat(at);
    const radiation = (Mock.Random.float(790, 820)); /* KW/m2 */
    const efficiency = 0.29;
    const area = 1.5;
    const poweroutput = radiation * efficiency * area;
    const deltat = atf - 4.0 - 25.0;
    const tempcoeff = -0.0045;
    const powerouteff = poweroutput * (1 + (tempcoeff * deltat));
    const current = 9.0 * (radiation / 1000);
    const voltage = powerouteff / current;

    // if it's night time everything goes to 0 except ambient temp and windspeed
    if (hrs > 23 || hrs < 6) {
        return {
            "ambienttemperature_c": atf.toFixed(2),
            "windspeed_mps": windspeed,
            "poweroutput_kw": 0.0,
            "current": 0.0,
            "voltage": 0.0,
            "tstamp": dateStr
        };
    } else {
        return {
            "ambienttemperature_c": atf.toFixed(2),
            "windspeed_mps": windspeed,
            "poweroutput_kw": powerouteff.toFixed(2),
            "current": current.toFixed(2),
            "voltage": voltage.toFixed(2),
            "tstamp": dateStr
        };
    }
}

async function getWeather(lat, long) {
    try {
        const params = {
            "latitude": lat,
            "longitude": long,
            "current": ["temperature_2m", "wind_speed_10m"],
            "wind_speed_unit": "ms",
            "hourly": "shortwave_radiation_instant",
            timezone: "America/Los_Angeles"
        };
        const responses = await fetchWeatherApi(url, params);

        // Process first location. Add a for-loop for multiple locations or weather models
        const response = responses[0];

        // Current values. The order of variables needs to be the same as requested.
        const current = response.current();
        const currentTemperature2m = current.variables(0).value();
        const currentWindSpeed10m = current.variables(1).value();

        const hourly = response.hourly();
        const radiation = hourly?.variables(0)?.value ?? 0;

        console.log(`${currentTemperature2m} ${currentWindSpeed10m} ${radiation}`);
        return [currentTemperature2m.toString(), currentWindSpeed10m.toString()];
    } catch (error) {
        console.error('Error fetching weather data:', error);
        return ['0', '0']; // Default values in case of error
    }
}
// ANCHOR: queryData
async function queryData() {
    let wsRows = null;
    let wsSql = null;
    let sql = 'SELECT ts,panelid, string_id, site FROM renewables.solarfarms limit 100';
    try {
        wsSql = await createConnect();
        wsRows = await wsSql.query(sql);
        while (await wsRows.next()) {
            let row = wsRows.getData();
            console.log('ts: ' + row[0] + ', panelid: ' + row[1] + ', string_id:  ' + row[2], ', site: ' + row[3]);
        }
    }
    catch (err) {
        console.error(`Failed to query data from renewables.solarfarms, sql: ${sql}, ErrCode: ${err.code}, ErrMessage: ${err.message}`);
        throw err;
    }
    finally {
        if (wsRows) {
            await wsRows.close();
        }
        if (wsSql) {
            await wsSql.close();
        }
    }
}

async function runDemo() {
    await createDbAndTable();
    await insertData();
}

runDemo();