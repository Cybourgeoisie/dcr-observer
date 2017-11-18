# Setting up the server

Normally I use docker, but that would lead to a lot of wasted cycles, and we're trying to be both efficient and cost-efficient. So let's skip all that and run this on the bare metal.

Also, docker usually assumes constant updates to the website. This site is more of a monitor than an actively developed platform. If it changes, we can change course, but there's no telling what interest this site will generate, if any.

# Installation

## Set up PAM and Google Authenticator

Following https://medium.com/aws-activate-startup-blog/securing-ssh-to-amazon-ec2-linux-hosts-18e9b72319d4

```
sudo yum install google-authenticator –y
google-authenticator
```
And all the following steps in the URL provided.

## Download required software

### Git

```
sudo yum install git
```

### Go - for dcrd

```
wget https://redirector.gvt1.com/edgedl/go/go1.9.2.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.9.2.linux-amd64.tar.gz 
sudo vim .bash_profile
^ Add ":/usr/local/go/bin" to $PATH variable
source .bash_profile
rm go1.9.2.linux-amd64.tar.gz
mkdir go
```

Had to go back to install git (listed earlier now)..

```
vim ~/.bashrc
^ "export GOPATH=$HOME/go"
go get -u github.com/golang/dep/cmd/dep
git clone https://github.com/decred/dcrd $GOPATH/src/github.com/decred/dcrd
cd $GOPATH/src/github.com/decred/dcrd
$GOPATH/bin/dep ensure
go install . ./cmd/...
```

### Install node.js

Using http://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/setting-up-node-on-ec2-instance.html

```
curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.6/install.sh | bash
```

Leave the session and return for nvm to be fully installed.

```
nvm install 8.9.1
```

And install the packages we need.

```
npm install shelljs
```


## Upload bootstrap, Start dcrd & Test dcrctl

On the home machine, create the bootstrap file and upload to the server:

```
zip -r dcrd-bootstrap.zip ./.dcrd
```

Uploading via sftp, taking forever...

While we're at it, let's also upload the parsed blocks, blocks.zip, created from the dcr-audit parser.

Now, on the server..

```
unzip dcrd-bootstrap.zip
```

And run the fucker.

```
cd ~/go/bin
screen -S dcrd
./dcrd --txindex
```


## Install Apache, PHP and Postgresql for server

Using a mix of sources:
- http://docs.aws.amazon.com/AWSEC2/latest/UserGuide/install-LAMP.html
- https://github.com/snowplow/snowplow/wiki/Setting-up-PostgreSQL
- http://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_Tutorials.WebServerDB.CreateWebServer.html
- https://gist.github.com/ccabanero/6471878


```
sudo yum update –y
sudo yum install -y httpd24 php70  postgresql96 postgresql96-server postgresql96-devel postgresql96-contrib postgresql96-docs php70-pgsql
```

Turn on Apache httpd, make sure it runs all the time.

```
sudo service httpd start
sudo chkconfig httpd on
chkconfig --list httpd
```

**Add a security rule to the EC2 instance to allow :80 access.**

Give permissions to the ec2-user to dick around with apache web files.

```
sudo usermod -a -G apache ec2-user
exit
```

Need to log back in.

```
sudo chown -R ec2-user:apache /var/www
sudo chmod 2775 /var/www
find /var/www -type d -exec sudo chmod 2775 {} \;
find /var/www -type f -exec sudo chmod 0664 {} \;
```

Now put a password on user "postgres" and init PSQL

```
sudo passwd postgres
sudo service postgresql initdb
sudo service postgresql start
```

Log into postgres

```
sudo su - postgres
psql -U postgres
```

**The next steps, setting the postgres password, creating a user and db, are stored in another location.**

## Pull the dcr-rich-list code

```
git clone https://github.com/Cybourgeoisie/dcr-rich-list.git
```

Also, push the data from the app folder. And copy it over to /var/www/html/ for now, since it all works online now anyway.

### Install PHP Composer and install server dependencies

Pulled from https://getcomposer.org/download/

```
php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
php -r "if (hash_file('SHA384', 'composer-setup.php') === '544e09ee996cdf60ece3804abc52599c22b1f40f4323403c44d44fdfdd586475ca9813a858088ffbc1f233e9b180f061') { echo 'Installer verified'; } else { echo 'Installer corrupt'; unlink('composer-setup.php'); } echo PHP_EOL;"
php composer-setup.php
php -r "unlink('composer-setup.php');"
```

## Apache - set env variables

Environment variables have to be set within /etc/sysconfig/httpd.
