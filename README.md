# TRD News Interactive MAPs

Inside each folder are the following items:

1. The Jupyter Notebook containing the script used to generate the map.

2. The data the notebook reads in (usually in the form of a CSV or PDF file).

3. The map - an HTML file always named `index.html`. 

The scripts use the Google Maps Geocoding API to take an address, exchange it for lat/lon coordinates and place a pin on the map. For security reasons, the API key isn't available in this repo. Talk to Adam if you need one for a map.

Otherwise, you can register for your own at `developers.google.com`. To use your own API Key, delete the first line of code in the snippet below, and replace `google_maps_API_Key` with your own. Again for security reasons, it's recommended you store the API Key in a config file listed in your `.gitignore`, along with `.ipynd_checkpoints` to prevent unauthorized access.


```%store -r google_maps_API_Key
geolocator = GoogleV3(api_key=google_maps_API_Key)```