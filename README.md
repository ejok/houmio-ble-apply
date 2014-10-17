What?
-----
houmio-ble-apply is a simple app that applies a scene when a pair of pre-configured BLE UUIDs are scanned in correct order by a BLE dongle attached to your Houmio central unit.
Can be used to turn on the lights when entering to an appartment, for example.

Example setup
-------------
An Estimote beacon with a built-in accelerometer is attach to the front door of an appartment and another one is attach to an inner door. When the front door is opened
first and the inner door right after that, it is intepreted as "someone is entering to the appartment". When that happens a pre-defined scene is applied.

Note: Both of the Estimote beacons need to be configured to have an unique motion proximity UUID, which is broadcasted when the beacon moves.

Getting started
---------------

1) Get a (USB) BLE dongle that work with Houmio central unit (which runs Raspberian). At least Asus BT-400 is known to work.

2) Compile Linux standard bluetooth stack in order to use the BLE dongle. Run the following commands (this will take quite a long time):

	sudo apt-get update
	sudo apt-get install libusb-dev libdbus-1-dev libglib2.0-dev libudev-dev libical-dev libreadline-dev bc
	sudo wget https://www.kernel.org/pub/linux/bluetooth/bluez-5.24.tar.xz
	sudo unxz bluez-5.24.tar.xz
  	sudo tar xvf bluez-5.24.tar
  	cd bluez-5.24/
  	sudo ./configure --disable-systemd
  	sudo make
  	sudo make install

 3) Reboot the central unit

 	sudo reboot

 4) Insert your BLE dongle

 5) Check that you can see your dongle (you should see hci0 device)

 	hciconfig -a

 6) Turn on the dongle device

 	sudo hciconfig hci0 up

Running houmio-ble-apply application
------------------------------------

1) Install dependencies

 	npm install

2) Define your Houmio site key and scene id to apply

	export HOUMIO_SITEKEY=<your sitekey>
	export HOUMIO_SCENEID=<scene id to apply>
	export OUTER_DOOR_BLE_UUID=<motion proximity UUID of the beacon attached to the outer door>
	export INNER_DOOR_BLE_UUID=<motion proximity UUID of the beacon attached to the inner door>

3) Run the application

 	node app.js
