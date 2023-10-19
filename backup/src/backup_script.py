#! /usr/bin/env python3

import os
import time
import datetime
import subprocess
import shutil
import boto3
import py7zr


# The number of hours between each backup.
sync_period = 24 * 7 # a week

# Location of the timestamp file.
ts_file = r'/app_data/last_backup'

# Location of the backup and tmp directories.
backup_dir = r'/backup'
temp_dir = r'/backup_temp'

# Name of the AWS S3 Bucket on eu-central-1.
bucket_name = os.environ['AWS_S3_BUCKET_NAME']
encryption_password = os.environ['ENCRYPTION_PASSWORD']


dtn = datetime.datetime.now().astimezone()


def main() -> None:
	print(f'\n\nBackup script was invoked at {dtn}.')

	with open(ts_file, 'r') as file:
		int_ts = int(file.read().strip())
	ts = datetime.datetime.fromtimestamp(int_ts).astimezone()

	# If this is the first time this script runs, adjust the timestamp.
	if int_ts == 1000000000:
		ts = (dtn - datetime.timedelta(hours=sync_period + 0.01))
		with open(ts_file, 'w') as file:
			file.write(str(int(ts.timestamp())))

	if dtn - ts > datetime.timedelta(hours=sync_period):
		#ret_code = subprocess.run(subprocess_arguments).returncode

		# If the subprocess was successful and the backup was
		# uploaded, set a new timestamp.
		if send_backup():
			with open(ts_file, 'w') as file:
				file.write(str(int(time.time())))
			print('Backup successful.')
		else:
			print(f'BACKUP FAILED.')

	else:
		print(f'{sync_period}h have not yet elapsed. Backup will be done after {ts + datetime.timedelta(hours=sync_period)}.')



def send_backup() -> bool:
	ret = True

	# create temp folder
	os.mkdir(temp_dir)

	archive_path = f'{temp_dir}/[{dtn}]_QA-Backup.7z'


	ret = ret and create_encrypted_7z_archive(backup_dir, archive_path,encryption_password)

	ret = ret and upload_to_S3(archive_path)

	# remove temp folder
	shutil.rmtree(temp_dir)

	return ret


def create_encrypted_7z_archive(source_directory: str, output_archive: str, password: str) -> bool:
	try:
		with py7zr.SevenZipFile(output_archive, 'w', password=password) as archive:
			for directoryname, subdirectories, filenames in os.walk(source_directory):
				for filename in filenames:
					filepath = os.path.join(directoryname, filename)
					archive.write(filepath, os.path.relpath(filepath, source_directory))
		return True
	except Exception as e:
		print('Archive could not be created.')
		return False


def upload_to_S3(file_path: str) -> bool:
	s3 = boto3.client('s3')
	try:
		with open(file_path, 'rb') as f:
				s3.upload_fileobj(f, bucket_name, os.path.basename(file_path), ExtraArgs={'StorageClass': 'GLACIER_IR'})
	except Exception as e:
		print(f'Archive could not be uploaded to S3. {e}')
		return False
	return True





if __name__ == '__main__':
	main()