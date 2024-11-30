rm server
gcc -o server server.c -lwebsockets -pthread
./server