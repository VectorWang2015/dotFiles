#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>


int main(int argc, char *args[]) {
	int num = 0;

	// read params, param should be signed int
	if (argc == 2) {
		num = atoi(args[1]);
	}
	else {
		exit(0);
	}

	if (access("/sys/class/backlight/amdgpu_bl0/brightness", W_OK) == 0) {
		FILE *br_fd = fopen("/sys/class/backlight/amdgpu_bl0/brightness", "r+");
		int br;
		char buf[4];

		//memset(buf, sizeof(buf), 0);

		fscanf(br_fd, "%d", &br);
		//printf("current brightness %d\n", br);
		br += num;
		br = (br<0?0:br);
		br = (br>255?255:br);
		//printf("current brightness %d\n", br);

		// reopen and write new brightness
		br_fd = freopen(NULL, "w", br_fd);
		sprintf(buf, "%d", br);
		for (int i=0; i<4; i++) {
			if (buf[i]!=0) {
				fputc(buf[i], br_fd);
			}
		}
		fclose(br_fd);
	}
	else {
		printf("Access denied");
	}
}
