// flair-metal-hash: 49c7cbcb
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL mod() function, which is slightly different than Metal fmod()
template<typename Tx, typename Ty>
inline Tx mod(Tx x, Ty y)
{
    return x - y * floor(x / y);
}

// Implementation of the GLSL radians() function
template<typename T>
inline T radians(T d)
{
    return d * T(0.01745329251);
}

struct FlairUniforms
{
    packed_float3 iResolution;
    float iTime;
    float iTimeDelta;
    int iFrame;
    float iBeat;
    float flair_flipY;
    float4 iMouse;
    float4 iPointer;
    float4 iClicks[8];
    float4 iTrail[32];
    float4 iAudio;
    float4 iSpectrum[16];
    float4 iScroll;
    int uDirection;
    float uSpeed;
    float uWidth;
    float uAngle;
    float uFrameAspect;
    float3 uBase;
    packed_float3 uEdge;
    uint uNegative;
    float uWear;
    char _m22_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_film_strip_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float2 fitInto(texture2d<float> tex, sampler texSmplr, thread const float2& uv, thread const float& aspect)
{
    float2 size = float2(int2(tex.get_width(), tex.get_height()));
    float _302;
    if (size.x > 1.0)
    {
        _302 = size.x / size.y;
    }
    else
    {
        _302 = aspect;
    }
    float imageAspect = _302;
    float2 _317;
    if (aspect > imageAspect)
    {
        _317 = float2(1.0, imageAspect / aspect);
    }
    else
    {
        _317 = float2(aspect / imageAspect, 1.0);
    }
    float2 scale = _317;
    return float2(0.5) + ((uv - float2(0.5)) * scale);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _131)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_131.uBackdrop) * _131.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_131.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float3 testCard(thread const float2& uv)
{
    float3 sky = mix(float3(0.980000019073486328125, 0.62000000476837158203125, 0.4199999868869781494140625), float3(0.23999999463558197021484375, 0.319999992847442626953125, 0.7200000286102294921875), float3(uv.y));
    float sun = smoothstep(0.1599999964237213134765625, 0.1500000059604644775390625, length((uv - float2(0.64999997615814208984375, 0.579999983310699462890625)) * float2(1.60000002384185791015625, 1.0)));
    float hills = step(uv.y, (0.319999992847442626953125 + (0.0599999986588954925537109375 * sin(uv.x * 9.0))) + (0.039999999105930328369140625 * sin((uv.x * 23.0) + 1.0)));
    float3 col = mix(sky, float3(1.0, 0.920000016689300537109375, 0.699999988079071044921875), float3(sun));
    col = mix(col, float3(0.119999997317790985107421875, 0.2800000011920928955078125, 0.23999999463558197021484375) + float3(0.07999999821186065673828125 * sin(uv.x * 40.0)), float3(hills));
    float2 grid = abs(fract(uv * 8.0) - float2(0.5));
    col += float3(0.039999999105930328369140625 * step(0.4799999892711639404296875, fast::max(grid.x, grid.y)));
    return col;
}

static inline __attribute__((always_inline))
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _131)
{
    float4 _273;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _273 = overBackdrop(param, _131);
    }
    else
    {
        float2 param_1 = fract(uv);
        _273 = float4(testCard(param_1), 1.0);
    }
    return _273;
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float roundBox(thread const float2& p, thread const float2& hs, thread const float& r)
{
    float2 q = (abs(p) - hs) + float2(r);
    return (length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0)) - r;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _131, texture2d<float> uImage, sampler uImageSmplr)
{
    float px = 1.0 / _131.iResolution[1u];
    float2 p = (fragCoord - (float2(_131.iResolution[0], _131.iResolution[1]) * 0.5)) / float2(_131.iResolution[1u]);
    float a = radians(_131.uAngle);
    p = float2x2(float2(cos(a), sin(a)), float2(-sin(a), cos(a))) * p;
    bool across = _131.uDirection == 1;
    float2 _407;
    if (across)
    {
        _407 = float2(p.y, p.x);
    }
    else
    {
        _407 = p;
    }
    float2 s = _407;
    float4 surround = float4(_131.uBackdrop[0], _131.uBackdrop[1], _131.uBackdrop[2], _131.uBackdropAlpha);
    float w = _131.uWidth;
    float margin = 0.1500000059604644775390625 * w;
    float win = w - (2.0 * margin);
    float _442;
    if (across)
    {
        _442 = win * _131.uFrameAspect;
    }
    else
    {
        _442 = win / _131.uFrameAspect;
    }
    float frameLen = _442;
    float gap = 0.070000000298023223876953125 * win;
    float pitch = frameLen + gap;
    float along = s.y - ((_131.iTime * _131.uSpeed) * pitch);
    float k = floor(along / pitch);
    float f = along - (k * pitch);
    float3 base = _131.uBase * (0.800000011920928955078125 + (0.300000011920928955078125 * cos((s.x / w) * 3.141590118408203125)));
    float4 film = float4(base, 1.0);
    float band = s.x - ((win * 0.5) + (margin * 0.07999999821186065673828125));
    float mark = step(0.0, band) * step(band, margin * 0.119999997317790985107421875);
    float2 param = float2(k, floor(f / (pitch / 14.0)));
    float dash = step(0.449999988079071044921875, hash12(param));
    float4 _539 = film;
    float3 _550 = mix(_539.xyz, float3(_131.uEdge), float3((0.75 * mark) * dash));
    film.x = _550.x;
    film.y = _550.y;
    film.z = _550.z;
    float2 local = float2((s.x / win) + 0.5, (f - (0.5 * gap)) / frameLen);
    float window = fast::max(abs(s.x) - (0.5 * win), abs(f - (0.5 * pitch)) - (0.5 * frameLen));
    float inWindow = 1.0 - smoothstep(-px, px, window);
    float2 _595;
    if (across)
    {
        _595 = float2(local.y, local.x);
    }
    else
    {
        _595 = local;
    }
    float2 uv = _595;
    float2 param_1 = uv;
    float param_2 = _131.uFrameAspect;
    float2 param_3 = fitInto(uImage, uImageSmplr, param_1, param_2);
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_3, _131);
    float3 col = pic.xyz;
    if (_131.uNegative != 0u)
    {
        col = ((float3(1.0) - col) * float3(1.0, 0.660000026226043701171875, 0.4199999868869781494140625)) + float3(0.07999999821186065673828125, 0.02999999932944774627685546875, 0.0);
    }
    float2 param_4 = float2(k, 3.0);
    col *= (1.0 - ((_131.uWear * 0.180000007152557373046875) * hash12(param_4)));
    for (int i = 0; i < 3; i++)
    {
        float2 param_5 = float2(k, float(i) * 7.099999904632568359375);
        float2 param_6 = float2(k, float(i) + 40.0);
        float3 h = float3(hash22(param_5), hash12(param_6));
        if (h.z > _131.uWear)
        {
            continue;
        }
        float r = (0.0040000001899898052215576171875 + (0.00999999977648258209228515625 * h.x)) * win;
        float speck = 1.0 - smoothstep(r - px, r + px, length((local - h.xy) * float2(win, frameLen)));
        col = mix(col, float3(0.039999999105930328369140625), float3(0.800000011920928955078125 * speck));
    }
    float2 param_7 = float2(floor(k / 5.0), 9.0);
    float scratch = ((hash12(param_7) - 0.5) * win) * 0.800000011920928955078125;
    col += float3((_131.uWear * 0.3499999940395355224609375) * (1.0 - smoothstep(0.0, 1.5 * px, abs(s.x - scratch))));
    float4 frameRGBA = float4(col, pic.w);
    film = mix(film, frameRGBA, float4(inWindow));
    float perf = pitch / 4.0;
    float2 hp = float2(abs(s.x) - ((0.5 * w) - (0.5 * margin)), mod(along, perf) - (0.5 * perf));
    float2 hole = float2(margin * 0.2700000107288360595703125, perf * 0.300000011920928955078125);
    float2 param_8 = hp;
    float2 param_9 = hole;
    float param_10 = 0.300000011920928955078125 * fast::min(hole.x, hole.y);
    float inHole = 1.0 - smoothstep(-px, px, roundBox(param_8, param_9, param_10));
    film = mix(film, surround, float4(inHole));
    float inStrip = 1.0 - smoothstep(-px, px, abs(s.x) - (0.5 * w));
    fragColor = mix(surround, film, float4(inStrip));
}

fragment flair_film_strip_frag_out flair_film_strip_frag(constant FlairUniforms& _131 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_film_strip_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _844;
    if (_131.flair_flipY > 0.5)
    {
        _844 = _131.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _844 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _844);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _131, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

