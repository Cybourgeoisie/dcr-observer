#!/bin/bash

# Update the blocks
cd /home/ec2-user/dcr-rich-list/src/collector/;
/home/ec2-user/.nvm/versions/node/v8.9.1/bin/node /home/ec2-user/dcr-rich-list/src/collector/collect_decred_blocks.js;

# Remove the existing SQL cache (if one exists) within the sql directory
cd /home/ec2-user/dcr-rich-list/src/translator/;
rm /home/ec2-user/dcr-rich-list/src/translator/sql_data/latest_blocks.sql;

# Run the block -> SQL translator
/bin/echo "Run the DB translator";
/home/ec2-user/.nvm/versions/node/v8.9.1/bin/node /home/ec2-user/dcr-rich-list/src/translator/produce_db_inserts.js;
# This creates the SQL file "latest_blocks.sql", which we import next...

# Import the blocks into postgres - silent.
/bin/echo "Import the new DB records";
/usr/bin/psql -d dcr-audit -U r9e43vzs5efe32gm -f /home/ec2-user/dcr-rich-list/src/translator/sql_data/latest_blocks.sql -q;

# Now we update the database balances - not silent.
/bin/echo "Update the balances";
/usr/bin/psql -d dcr-audit -U r9e43vzs5efe32gm -f /home/ec2-user/dcr-rich-list/src/sql/scripts/update_with_latest_blocks.sql;

# And now we produce the HD cache information
/bin/echo "Produce new list caches";
cd /home/ec2-user/dcr-rich-list/src/parser/;
/home/ec2-user/.nvm/versions/node/v8.9.1/bin/node --max-old-space-size=3072 /home/ec2-user/dcr-rich-list/src/parser/get_all_data_from_blocks.js;

# And lastly copy the data over to the data directory
cp -a /home/ec2-user/dcr-rich-list/src/parser/*json /var/www/html/data/;
/bin/echo "Done";
