#include <libwebsockets.h>
#include <signal.h>
#include <stdint.h>
#include <time.h>   // time() için
#include <stdio.h>  // printf için
#include <pthread.h>
#include <unistd.h>  // sleep() için
#include <math.h> // ceil() için
#include <stdbool.h>

#include "server.h"

#define MAX_DEVICES 100
#define MAX_FPS 50
#define APP_PRE 1
#define IMAGE_BITRATE 1


// Global vars
static struct {
    // system
    bool interrupted;

    // Lws
    struct lws_context *context;    // WebSocket context

    // My
    struct device devices[MAX_DEVICES];
    int device_count;

    // Test
    int test_color;
} globals = {
    .context = NULL,
    .interrupted = false
};

// System funcs
    void sigint_handler(int sig) {
        globals.interrupted = true;
        //printf("\nglobals.interrupted: %d\n",globals.interrupted);
    }
    void drop_connection(int device_id){
        printf("\nBağlantıyı zorla durdur!\n");
        globals.devices[device_id].is_active = false;
        return;
    }
// System end

// Senders
    void send_image(int device_id, enum fill_types fill_type, uint16_t x_pos, uint16_t y_pos){
        if(!globals.device_count)return;
        if(!fill_type)return;

        // Set data header
        globals.devices[device_id].buffer[LWS_PRE + 0] = IMAGE_DATA;
        globals.devices[device_id].buffer[LWS_PRE + 1] = fill_type;


        int payload = LWS_PRE   // 16 byte websocket reserved
                    + APP_PRE   // 1 byte for the data type to be sent. (out_type=IMAGE_DATA)
                    + 1;        // 1 byte reserved for this function. (fill_type=%)


        switch (fill_type) {
            case FILL_256_BOX:

                // custom bytes 3 and 4 [2,3]: image x pos (16 bit)
                // custom bytes 5 and 6 [4,5]: image y pos (16 bit)
                payload += 4;   // 4 byte more reserved for proccess header


                // image x pos (16 bit)
                globals.devices[device_id].buffer[LWS_PRE + 2] = (x_pos & 0xFF); // little-endian
                globals.devices[device_id].buffer[LWS_PRE + 3] = ((x_pos >> 8) & 0xFF);

                // image y pos (16 bit)
                globals.devices[device_id].buffer[LWS_PRE + 4] = (y_pos & 0xFF); // little-endian
                globals.devices[device_id].buffer[LWS_PRE + 5] = ((y_pos >> 8) & 0xFF);

                int start_index = 1000;
                
                int send_size = payload + (256*256);
                lws_write(globals.devices[device_id].wsi, &globals.devices[device_id].buffer[LWS_PRE], send_size - LWS_PRE, LWS_WRITE_BINARY);
                //printf("Giden: %d byte IMAGE.FILL_256_BOX x:%d y:%d\n", send_size, x_pos, y_pos);
                //free(buffer);
                break;
        }
    }
// Senders end

// Device manage funcs
    int add_device(struct lws *wsi) {
        if (globals.device_count >= MAX_DEVICES) return -1;
        
        for (int i = 1; i <= MAX_DEVICES; i++) {
            if (!globals.devices[i].is_active) {
                globals.devices[i].wsi = wsi;
                globals.devices[i].id = i;
                globals.devices[i].is_active = true;
                globals.device_count++;
                return i;
            }
        }
        return -1;
    }
    int remove_device(struct lws *wsi) {
        for (int i = 1; i <= MAX_DEVICES; i++) {
            if (globals.devices[i].wsi == wsi && globals.devices[i].is_active) {
                globals.devices[i].is_active = false;
                globals.devices[i].wsi = NULL;
                globals.device_count--;
                return i;
            }
        }
        return -1;
    }
    int set_screen_size(struct lws *wsi, uint16_t width, uint16_t height) {
        printf("set_screen_size(width:%d height:%d) \n",width,height);
        for (int i = 1; i <= MAX_DEVICES; i++) {
            if (globals.devices[i].wsi == wsi && globals.devices[i].is_active) {

                size_t buffer_size = LWS_PRE + APP_PRE + (width * height * IMAGE_BITRATE);
                unsigned char* buffer = malloc(buffer_size);
                if (buffer == NULL) {
                    drop_connection(i);
                    return -1;
                }

                globals.devices[i].buffer = buffer;
                globals.devices[i].width = width;
                globals.devices[i].height = height;

                printf("WS_Payload:%d App_payload:%d Device_buffer_size:%d\n", LWS_PRE, APP_PRE, buffer_size);

                for (int i = LWS_PRE + APP_PRE; i < buffer_size; i++)
                {
                    buffer[i] = ceil((i/width) % 252);
                }

                //globals.devices[i].tparams.id = i;
                //1pthread_create(&globals.devices[i].thread, NULL, thread_func, &globals.devices[i].tparams);
                return 0;
            }
        }
        return -1;
    }
// Device manage end

// Handlers funcs
    static int handle_key_down(struct lws *wsi, const char *data, size_t len, struct handler_context *ctx) {
        printf("KEY_DOWN: %c %d %d\n", data[0], data[0], len);
        return 0;
    }
    static int handle_key_up(struct lws *wsi, const char *data, size_t len, struct handler_context *ctx) {
        printf("KEY_UP: %c %d %d\n", data[0], data[0], len);
        return 0;
    }
    static int handle_pointer_down(struct lws *wsi, const char *data, size_t len, struct handler_context *ctx) {
        //printf("POINTER_DOWN: %d %d %d %d %d %d\n", len, (uint8_t)data[0], (uint8_t)data[1], (uint8_t)data[2], (uint8_t)data[3], (uint8_t)data[4]);
        uint8_t id = (uint8_t)data[0];
        uint16_t x = ((uint8_t)data[2] << 8) | (uint8_t)data[1];
        uint16_t y = ((uint8_t)data[4] << 8) | (uint8_t)data[3];
        printf("POINTER_DOWN id:%d x:%d y:%d\n",id,x,y);
        return 0;
    }
    static int handle_pointer_up(struct lws *wsi, const char *data, size_t len, struct handler_context *ctx) {
        //printf("POINTER_UP: %d %d %d %d %d %d\n", len, (uint8_t)data[0], (uint8_t)data[1], (uint8_t)data[2], (uint8_t)data[3], (uint8_t)data[4]);
        uint8_t id = (uint8_t)data[0];
        uint16_t x = ((uint8_t)data[2] << 8) | (uint8_t)data[1];
        uint16_t y = ((uint8_t)data[4] << 8) | (uint8_t)data[3];
        printf("POINTER_UP id:%d x:%d y:%d\n",id,x,y);
        return 0;
    }
    static int handle_pointer_move(struct lws *wsi, const char *data, size_t len, struct handler_context *ctx) {
        //printf("POINTER_MOVE: %d %d %d %d %d %d\n", len, (uint8_t)data[0], (uint8_t)data[1], (uint8_t)data[2], (uint8_t)data[3], (uint8_t)data[4]);
        uint8_t id = (uint8_t)data[0];
        uint16_t x = ((uint8_t)data[2] << 8) | (uint8_t)data[1];
        uint16_t y = ((uint8_t)data[4] << 8) | (uint8_t)data[3];
        //printf("POINTER_MOVE id:%d x:%d y:%d\n",id,x,y);


        for (int i = 1; i <= MAX_DEVICES; i++) {
            if (globals.devices[i].is_active) {
                send_image(i, FILL_256_BOX, x, y);
            }
            else{
                return 0;
            }
        }
        return 0;
    }
    static int handle_screen_size(struct lws *wsi, const char *data, size_t len, struct handler_context *ctx) {
        //printf("SCREEN_SIZE: %d byte[%d,%d,%d,%d]\n", len,  (uint8_t)data[0],  (uint8_t)data[1],  (uint8_t)data[2],  (uint8_t)data[3]);
        uint16_t width = ((uint8_t)data[1] << 8) | (uint8_t)data[0];
        uint16_t height = ((uint8_t)data[3] << 8) | (uint8_t)data[2];
        set_screen_size(wsi, width, height);
        return 0;
    }
    // hadle lookup table
    static const message_handler handlers[] = {
        [KEY_DOWN] = handle_key_down,
        [KEY_UP] = handle_key_up,
        [POINTER_DOWN] = handle_pointer_down,
        [POINTER_UP] = handle_pointer_up,
        [POINTER_MOVE] = handle_pointer_move,

        [SCREEN_SIZE] = handle_screen_size
    };
    int handle_router(struct lws *wsi, const char *data, size_t len) {
        // İlk byte'ı mesaj tipi olarak al
        uint8_t msg_type = (uint8_t)data[0];
        
        // Tip geçerli mi kontrol et
        if (msg_type >= sizeof(handlers) / sizeof(handlers[0]) || 
            handlers[msg_type] == NULL) {
            lwsl_err("Invalid message type: %d\n", msg_type);
            return -1;
        }

        // Context'i hazırla
        struct handler_context ctx = {
            //.game = get_current_game(),
            //.session = get_user_session(wsi),
            //.db = get_db_connection()
        };

        // İlgili handler'ı çağır (data+1 ile type byte'ını atlıyoruz)
        return handlers[msg_type](wsi, data + 1, len - 1, &ctx);
    }
// Handlers end

// Websocket funcs & vars
    static int callback_ws(struct lws *wsi, enum lws_callback_reasons reason, void *user, void *in, size_t len) {
        switch (reason) {
            case LWS_CALLBACK_ESTABLISHED:
                uint16_t device_id = add_device(wsi);
                if (device_id < 0) {
                    return -1;
                }

                printf("\nYeni cihaz bağlandı, ID: %d\n", device_id);
                break;

            case LWS_CALLBACK_RECEIVE:            
                handle_router(wsi, in, len);
                break;


            case LWS_CALLBACK_CLOSED:
                printf("\nBağlantı kapandı, ID: %d\n", remove_device(wsi));
                break;


            case LWS_CALLBACK_PROTOCOL_INIT:
                printf("\nREADY\n");
                break;
                
            case LWS_CALLBACK_PROTOCOL_DESTROY:
                printf("\nDESTROY\n");
                break;
                

            default:
                break;
        }
        return 0;
    }
    static const struct lws_protocols protocols[] = {
        {
            .name = "user-protocol",
            .callback = callback_ws,
            .per_session_data_size = 0,
            .rx_buffer_size = 0,
            .id = 0,
            .user = NULL,
            .tx_packet_size = 0
        },
        { NULL, NULL, 0, 0 }
    };
// Websocket funcs & vars end

// Threads
    void *background_processor(void *arg) { // Worker thread
        while (globals.interrupted == false) {
            //printf("bg start\n");
            for (int i = 1; i <= MAX_DEVICES; i++) {
                if (globals.devices[i].is_active) {

                    int jump = LWS_PRE + APP_PRE + 5;
                    for (int j = jump; j < jump + (256*256); j++) {
                        globals.devices[i].buffer[j] = (rand() % 252) + 1;
                    }

                }
                else {
                    break;
                }
            }
            //printf("bg end\n");
            usleep(ceil(1000000/MAX_FPS));  // Unix/Linux için
        }
        return NULL;
    }
// Threads end

int main(void) {

    // SIGINT sinyalini yakala
    signal(SIGINT, sigint_handler);

    pthread_t worker;
    pthread_create(&worker, NULL, background_processor, NULL);

    // Websocket Main
        struct lws_context_creation_info info;
        memset(&info, 0, sizeof info);

        info.port = 8000;
        info.protocols = protocols;
        info.gid = -1;
        info.uid = -1;
        
        // Log seviyesini ayarla
        lws_set_log_level(LLL_USER | LLL_ERR | LLL_WARN | LLL_NOTICE, NULL);

        // WebSocket sunucusunu başlat
        globals.context = lws_create_context(&info);
        if (!globals.context) {
            lwsl_err("lws context oluşturulamadı\n");
            return 1;
        }

        lwsl_notice("Sunucu başlatıldı - port %d\n", info.port);

        // Ana döngü
        while (!globals.interrupted) {
            lws_service(globals.context, 50);
        }

        // Temizlik
        lws_context_destroy(globals.context);
    // Websocket end

    pthread_join(worker, NULL);
    return 0;
}