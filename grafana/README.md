# Grafana


## Requirements

* Please make sure you have installed the [docker](https://www.docker.com/), and then running the following commands to start the demo:

  ```bash
  docker-compose up -d
## Connect TDengine to Grafana.

* Login to Grafana http://localhost:3000 with `admin`, `passwerd`
* Go to  → Settings → Data Sources.
* Click "Add Data Source" → Select TDengine Datasource.
* Enter Connection Details:
  * Name: tdengine-datasource
  * URL: http://tdengine:6041
  * User: root
  * Password: taosdata
* Click "Save & Test" to verify the connection.


## Pre-Built Dashboard

* Import grafana-dashboards/solarfarm_dashboard.json from this repository