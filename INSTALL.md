# Install

The following instructions have been tested on macOS (for development) and CentOS 7.X (for production). While it's certainly possible to host or test Shelf on many different environments, the below instructions will almost certainly need to be tweaked.

## macOS - Development

### Install Dependencies

Just use [brew](https://brew.sh), trust me.

* `brew install nginx`
* `brew install mongo`
* `brew install node`

### Shelf Setup

Since this is a development environment, there's no need to setup Nginx, Shelf will just be served locally.

* Clone the repository (`git clone git@github.com:barrowclift/shelf.git`)
* In the cloned repo, `npm install`
* Finally, edit `server/config.json` with your Discogs information. To generate a Discogs token, navigate to [this link](https://www.discogs.com/settings/developers) and click the "Generate new token" button.
* `./start.sh` to spin up Shelf, check the `logs/` directory to see if there are any errors

## CentOS 7.X - Production

### Install Dependencies

* [Follow the steps here to install Nginx](https://www.digitalocean.com/community/tutorials/how-to-install-nginx-on-centos-7)
* [Follow the relevant steps outlined here to install MongoDB](https://www.liquidweb.com/kb/how-to-install-mongodb-on-centos-6/). It's for CentOS 6, but the steps still apply.
* [Follow the relevant steps outlined here to install Node.js](https://www.digitalocean.com/community/tutorials/how-to-install-and-run-a-node-js-app-on-centos-6-4-64bit). Again, it's for CentOS 6, but the steps still apply. __NOTE__: Building Node from scratch takes a LONG time. Please get up to make some tea or bake a pie while it's churning. Trust me, you'll have the time.

### Nginx Configuration

There's one minor tweak that needs to be made to the `/etc/nginx/nginx.conf` file that's not mentioned in the DigitalOcean steps linked above to install Nginx. You need to have Nginx act as a reverse proxy to Shelf (which is a Node app), so you should edit your `server` block to look something like this.

```
server {
    listen 80; # Or 443 if SSL

    # Feel free to keep the superfluous stuff in the default config like logging, etc.

    server_name your_domain.com;
    location / {
        proxy_pass http://private_ip_address:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
     }
}
```

### Shelf Setup

* Clone the repository (`git clone git@github.com:barrowclift/shelf.git`)
* In the cloned repo, `npm install`
* Finally, edit `server/config.json` with your Discogs information. To generate a Discogs token, navigate to [this link](https://www.discogs.com/settings/developers) and click the "Generate new token" button.
* `./start.sh` to spin up Shelf, check the `logs/` directory to see if there are any errors