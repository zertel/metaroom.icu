// Enums
    enum in_types {
        //Input events (1-100)
        KEY_DOWN = 1,
        KEY_UP,
        POINTER_DOWN,
        POINTER_UP,
        POINTER_MOVE,
        
        //System Request Answers (101+)
        SCREEN_SIZE = 101,
        
        //Permission Request Answers (255-)
        VIDEO_INPUT_PERMISSION = 253,
        AUDIO_INPUT_PERMISSION,
        AUDIO_OUTPUT_PERMISSION
    };
    enum out_types {
        //Data bulks (1-100)
        IMAGE_DATA = 1,
        AUDIO_DATA,

        //System Requests (101+)
        REQUEST_SCREEN_SIZE = 101,

        //Permission Requests (255-)
        REQUEST_VIDEO_INPUT_PERMISSION = 253,
        REQUEST_AUDIO_INPUT_PERMISSION,
        REQUEST_AUDIO_OUTPUT_PERMISSION
    };
    enum fill_types {
        FILL_FULL_CANVAS=1,
        FILL_256_BOX,
        FILL_BOX,
        FILL_RECT
    };
// Enums end

// App
    typedef struct {
        int id;
        char *message;
    } ThreadParam;
    struct device {
        struct lws *wsi;    // WebSocket bağlantısı
        int id;             // Cihaz ID'si
        bool is_active;     // Cihaz aktif mi?

        unsigned char* buffer;
        int buffer_size;
        
        uint16_t width;     
        uint16_t height;
        pthread_t thread;
        ThreadParam tparams;
        //device_thread_cb thread_cb;
    };
// App end

// Queue
    struct queue_node {
        void *data;
        struct queue_node *next;
    };
    typedef struct {
        struct queue_node *head;
        struct queue_node *tail;
        pthread_mutex_t mutex;
        pthread_cond_t cond;
    } queue_t;

    struct message_queue_item {
        uint8_t type;
        char *data;
        size_t len;
    };
// Queue end

// Handlers 
    struct handler_context {
        // Tüm handler'ların erişmesi gereken ortak verileri içeren yapı
        //struct game_state *game;          // Oyun durumu
        //struct user_session *session;     // Kullanıcı oturum bilgileri
        //struct db_connection *db;         // Veritabanı bağlantısı
        //void *shared_memory;             // Paylaşılan bellek alanı
        // ... diğer paylaşılan kaynaklar
    };
// Handlers end

// Typedefs
    // Handler fonksiyon tipini tanımlayalım
    //typedef int (*device_thread_cb)(struct lws *wsi);
    typedef int (*message_handler)(struct lws *wsi, const char *data, size_t len, struct handler_context *ctx);
// Typedefs end
