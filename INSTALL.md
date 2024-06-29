# Install

The following instructions have been tested and verified on [macOS](https://www.apple.com/macos) (for development) and [CentOS](https://www.centos.org) 7.X (for production). While it's certainly possible to test and host Shelf on many different environments, it may require additional configuration.

## macOS - Installation for Development

### Install Dependencies

Just use [brew](https://brew.sh), trust me.

* `brew install nginx`
* `brew install mongodb-community`
* `brew install node`

### Shelf Setup

Since this is a development environment, there's no need to setup Nginx, Shelf can just be served directly.

* Clone the repository (`git clone git@github.com:barrowclift/shelf.git`)
* In the cloned repo, `npm install`
* If you don't already have `pm2` for node process management installed, do so with `npm install pm2 -g`
* (Optional) Should you wish Shelf to automatically start on startup, see [this short guide](http://pm2.keymetrics.io/docs/usage/startup/) or execute `pm2 startup` after having already started Shelf with pm2 enabled in `init.sh`.
* Shelf uses MongoDB to manage its data. When starting the MongoDB server, it expects permissions to create a DB at `/var/lib/mongodb`. If this location is not desired or if you have a MongoDB server already running for other projects, update the `MONGO_DB` variable in `admin/init.sh` to your desired path.
* Edit `backend/resources/shelf.properties` with your Discogs and/or BoardGameGeek information. Shelf uses these services to display your library. See the ["Setup"](https://github.com/barrowclift/shelf/blob/master/README.md#setup) section of the [README](https://github.com/barrowclift/shelf/blob/master/README.md) for more information.
* Finally, continue editing `backend/resources/shelf.properties`, replacing all instances of `SET_ME` with the appropriate information

To spin up Shelf, execute `admin/start.sh`. Be sure to check the `logs/` directory to see if there are any errors.

## Rocky Linux - Installation for Production

### Install Dependencies

* [Follow the steps here to install Nginx](https://www.digitalocean.com/community/tutorials/how-to-install-nginx-on-rocky-linux-8)
* [Follow the relevant steps outlined here to install MongoDB](https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-red-hat/)
* [Follow the relevant steps outlined here to install Node.js](https://www.digitalocean.com/community/tutorials/how-to-install-node-js-on-rocky-linux-8)

### Nginx Configuration

There's one minor tweak that needs to be made to the `/etc/nginx/nginx.conf` file to have your newly installed Nginx server act as a reverse proxy for Shelf, so you should edit your `server` block to look something like this.

```
server {
    # plain-old HTTP
    listen 80;
    # If HTTPS is desired, replace the above with the following:
    # listen 443;
    # listen [::]:443;
    # ssl on;
    # ssl_certificate /etc/nginx/ssl/server.crt; (or wherever your crt path is)
    # ssl_certificate_key /etc/nginx/ssl/server.key; (or wherever your key path is)

    # Feel free to keep the extra stuff in the default config like logging, etc.

    server_name your_domain.com www.your_domain.com;

    # If you changed
    location / {
        # For the port, use whatever port value you chose in
        # server/config.json's nodeWebsitePort field. By default, it's 10800.
        proxy_pass http://localhost:10800;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Additionally, when using a reverse proxy with Node, Nginx requires SELinux to be in permissive mode, which is described in more detail [here](https://wiki.gentoo.org/wiki/SELinux/Tutorials/Permissive_versus_enforcing). As described in that article, you can either set the required processes to be in "permissive" mode, or change the global SELinux mode by setting the `SELINUX` parameter in `/etc/selinux/config` to `permissive` and restarting.

### Shelf Setup

* Clone the repository (`git clone git@github.com:barrowclift/shelf.git`)
* In the cloned repo, `npm install`
* Shelf uses MongoDB to manage its data. When starting the MongoDB server, it expects permissions to create a DB at `/var/lib/mongo`. If this location is not desired or if you have a MongoDB server already running for other projects, update the `MONGO_DB` variable in `admin/init.sh` to your desired path.
* Edit `backend/resources/shelf.properties` with your Discogs information. To generate a Discogs token, navigate to [this link](https://www.discogs.com/settings/developers) and click the "Generate new token" button.
* Edit `backend/resources/shelf.properties` with your Discogs and/or BoardGameGeek information. Shelf uses these services to display your library. See the ["Setup"](https://github.com/barrowclift/shelf/blob/master/README.md#setup) section of the [README](https://github.com/barrowclift/shelf/blob/master/README.md) for more information.
* Finally, continue editing `backend/resources/shelf.properties`, replacing all instances of `SET_ME` with the appropriate information.

To spin up Shelf, execute `admin/start.sh`. Be sure to check the `logs/` directory to see if there are any errors.