git fetch origin
git stash push deployment/config.yml
git reset --hard origin/main
git stash pop
echo "Your config file needs to be updated manually."