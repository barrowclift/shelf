# Install

The following instructions have been tested on macOS (for development) and CentOS 7.X (for production). While it's certainly possible to host or test Shelf on many different environments, it may require additional configuration.

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
* If you don't already have `pm2` for node process management installed, do so with `npm install pm2 -g`
* (Optional) Should you wish Shelf to automatically start on startup, see [this short guide](http://pm2.keymetrics.io/docs/usage/startup/) or execute `pm2 startup` to let `pm2` handle the settings for you.
* Edit `server/config.json` with your Discogs information. To generate a Discogs token, navigate to [this link](https://www.discogs.com/settings/developers) and click the "Generate new token" button.
* Edit `config.sh`, updating `ABSOLUTE_PATH_TO_SHELF` with the absolute path Shelf lives on in your system.
* Finally, replace the About page placeholder with your own name and site. Be proud of your collection! :)

To spin up Shelf, execute `./start.sh`. Be sure to check the `logs/` directory to see if there are any errors.

## CentOS 7.X - Production

### Install Dependencies

* [Follow the steps here to install Nginx](https://www.digitalocean.com/community/tutorials/how-to-install-nginx-on-centos-7)
* [Follow the relevant steps outlined here to install MongoDB](https://www.liquidweb.com/kb/how-to-install-mongodb-on-centos-6/). It's for CentOS 6, but the steps still apply.
* [Follow the relevant steps outlined here to install Node.js](https://www.digitalocean.com/community/tutorials/how-to-install-and-run-a-node-js-app-on-centos-6-4-64bit). Again, it's for CentOS 6, but the steps still apply. __NOTE__: Building Node from scratch takes a LONG time. Please get up to make some tea or bake a pie while it's churning. Trust me, you'll have the time.
* Ensure `config.sh`'s `ABSOLUTE_PATH_TO_SHELF` matches the project's absolute path in the production environment.

### Nginx Configuration

There's one minor tweak that needs to be made to the `/etc/nginx/nginx.conf` file that's not mentioned in the DigitalOcean steps linked above to install Nginx. You need to have Nginx act as a reverse proxy to Shelf (which is a Node app), so you should edit your `server` block to look something like this.

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
* Edit `server/config.json` with your Discogs information. To generate a Discogs token, navigate to [this link](https://www.discogs.com/settings/developers) and click the "Generate new token" button.
* Finally, replace the About page placeholder with your own name and site. Be proud of your collection! :)

To spin up Shelf, execute `./start.sh`. Be sure to check the `logs/` directory to see if there are any errors.