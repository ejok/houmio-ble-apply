What?
-----
houmio-ble-apply is a simple app that applies a scene when a pre-configured BLE advertising message is scanned by a BLE dongle attached to your Houmio central unit.

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

3) Run the application

 	node app.js
