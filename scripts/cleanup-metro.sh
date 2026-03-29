#1. Stop all background watchers
watchman watch-del-all || true
killall -9 node || true

#2. Delete the actual DATA caches (not the libraries)
phome="/Users/palam/Projects/Web/NagaratharNexus-Expo"
rm -rf ${phome}/.expo
rm -rf ${phome}/node_modules/.cache/metro
rm -rf ${phome}/node_modules/.cache/babel-loader

#3. Delete the System-level transform buffer (The "Hidden" Poison)
#rm -rf /tmp/metro-cache*
#rm -rf $TMPDIR/metro-cache*
