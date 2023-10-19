#! /usr/bin/env python3

import os
import sys
import datetime
import time
import backup_script

locations = [
	r'/app/backup_script.py',
	r'/etc/crontabs/crontab',
	backup_script.backup_folder,
	backup_script.temp_dir,
	backup_script.ts_file
]

def main() -> None:

	time.sleep(1)

	# Assert that files and directories exist.
	for l in locations:
		if not os.path.exists(l):
			sys.exit(1)
	
	# Assert that the last backup was recently.
	with open(backup_script.ts_file, 'r') as file:
		int_ts = int(file.read().strip())
	ts = datetime.datetime.fromtimestamp(int_ts).astimezone()
	if datetime.datetime.now().astimezone() - ts > datetime.timedelta(hours=backup_script.sync_period*2):
		sys.exit(1)
	
	sys.exit(0)

if __name__ == '__main__':
	main()
