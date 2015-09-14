#include <jansson.h>

#include "jt_messages.h"

int jt_msg_handler(char *in)
{
	json_t *root;
	json_error_t error;
	int err;
	int i;
	void *data;

	root = json_loads(in, 0, &error);
	if (!root) {
		fprintf(stderr, "error: on line %d: %s\n", error.line,
		        error.text);
		return -1;
	}

	for (i = 0; i < JT_MSG_END; i++) {
		err = jt_messages[i].unpack(root, &data);
		if (!err) {
			jt_messages[i].consume(data);
			json_decref(root);
			return 0;
		}
	}
	printf("couldn't unpack message: %s\n", in);
	json_decref(root);
	return -1;
}
