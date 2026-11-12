// flair-metal-hash: d92aeded
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

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
    float uSepia;
    float uFade;
    float uFoxing;
    float uSilver;
    float uCreases;
    float uWear;
    float uSeed;
    char _m20_pad[4];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_aged_photo_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _241)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_241.uBackdrop) * _241.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_241.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _241)
{
    float4 _378;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _378 = overBackdrop(param, _241);
    }
    else
    {
        float2 param_1 = fract(uv);
        _378 = float4(testCard(param_1), 1.0);
    }
    return _378;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float vnoise(thread const float2& p)
{
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = (f * f) * (float2(3.0) - (f * 2.0));
    float2 param = i;
    float a = hash12(param);
    float2 param_1 = i + float2(1.0, 0.0);
    float b = hash12(param_1);
    float2 param_2 = i + float2(0.0, 1.0);
    float c = hash12(param_2);
    float2 param_3 = i + float2(1.0);
    float d = hash12(param_3);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

static inline __attribute__((always_inline))
float fbm(thread float2& p, thread const int& octaves)
{
    float sum = 0.0;
    float amp = 0.5;
    float2x2 turn = float2x2(float2(0.800000011920928955078125, 0.60000002384185791015625), float2(-0.60000002384185791015625, 0.800000011920928955078125));
    for (int i = 0; i < 8; i++)
    {
        if (i >= octaves)
        {
            break;
        }
        float2 param = p;
        sum += (amp * vnoise(param));
        p = ((turn * p) * 2.019999980926513671875) + float2(17.0);
        amp *= 0.5;
    }
    return sum;
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float2 crease(thread const float2& p, thread const float& i, constant FlairUniforms& _241)
{
    float2 param = float2(i * 3.2999999523162841796875, _241.uSeed);
    float2 h = hash22(param);
    float2 at = (h - float2(0.5)) * float2(0.800000011920928955078125, 0.60000002384185791015625);
    float2 param_1 = float2(i, _241.uSeed + 1.0);
    float a = hash12(param_1) * 3.141590118408203125;
    float2 dir = float2(cos(a), sin(a));
    float side = dot(p - at, float2(-dir.y, dir.x));
    float along = dot(p - at, dir);
    float2 param_2 = float2(along * 30.0, i * 9.0);
    float broken = smoothstep(0.3499999940395355224609375, 0.550000011920928955078125, vnoise(param_2));
    float2 param_3 = float2(along * 12.0, i);
    float wobble = (vnoise(param_3) - 0.5) * 0.006000000052154064178466796875;
    float d = abs(side + wobble);
    return float2(exp((-d) / 0.00179999996908009052276611328125) * broken, (exp((-fast::max(side + wobble, 0.0)) / 0.006000000052154064178466796875) * step(0.0, side + wobble)) * 0.60000002384185791015625);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _241, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_241.iResolution[0], _241.iResolution[1]);
    float aspect = _241.iResolution[0u] / _241.iResolution[1u];
    float2 p = (fragCoord - (float2(_241.iResolution[0], _241.iResolution[1]) * 0.5)) / float2(_241.iResolution[1u]);
    float2 param = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _241);
    float l = dot(pic.xyz, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
    float3 sep = (float3(l) * float3(1.07000005245208740234375, 0.930000007152557373046875, 0.7400000095367431640625)) + float3(0.039999999105930328369140625, 0.0199999995529651641845703125, 0.0);
    float3 col = mix(pic.xyz, sep, float3(_241.uSepia));
    col = mix(col, float3(0.119999997317790985107421875) + (col * 0.7799999713897705078125), float3(_241.uFade));
    float2 param_1 = (p * 3.0) + float2(_241.uSeed);
    int param_2 = 4;
    float _574 = fbm(param_1, param_2);
    float blotch = _574;
    col *= mix(float3(1.0), float3(0.980000019073486328125, 0.89999997615814208984375, 0.7200000286102294921875), float3(_241.uFoxing * smoothstep(0.449999988079071044921875, 0.75, blotch)));
    float2 g = p * 22.0;
    float2 gi = floor(g);
    float2 param_3 = gi + float2(_241.uSeed);
    float2 h = hash22(param_3);
    float fd = length((fract(g) - float2(0.25)) - (h * 0.5));
    float fr = 0.07999999821186065673828125 + (0.20000000298023223876953125 * fract(h.x * 11.0));
    float2 param_4 = gi + float2(_241.uSeed * 2.0);
    float fox = step(hash12(param_4), 0.180000007152557373046875 * _241.uFoxing) * (1.0 - smoothstep(0.699999988079071044921875 * fr, fr, fd));
    col = mix(col, col * float3(0.7200000286102294921875, 0.519999980926513671875, 0.319999992847442626953125), float3(fox * (0.60000002384185791015625 + (0.4000000059604644775390625 * smoothstep(0.5 * fr, fr, fd)))));
    float edgeD = fast::min((0.5 * aspect) - abs(p.x), 0.5 - abs(p.y));
    float where = (1.0 - smoothstep(0.100000001490116119384765625, 0.5, l)) * (0.4000000059604644775390625 + (0.60000002384185791015625 * (1.0 - smoothstep(0.0, 0.20000000298023223876953125, edgeD))));
    float sheen = 0.5 + (0.5 * sin((dot(p, float2(2.0, 1.2000000476837158203125)) * 3.0) + (_241.iTime * 0.3499999940395355224609375)));
    col += ((((float3(0.319999992847442626953125, 0.37000000476837158203125, 0.449999988079071044921875) * where) * sheen) * _241.uSilver) * 0.60000002384185791015625);
    for (int i = 0; i < 3; i++)
    {
        float2 param_5 = p;
        float param_6 = float(i);
        float2 c = crease(param_5, param_6, _241) * _241.uCreases;
        col = mix(col, col * 0.75, float3(c.y * 0.5));
        col = mix(col, float3(0.930000007152557373046875, 0.89999997615814208984375, 0.819999992847442626953125), float3(c.x));
    }
    float2 param_7 = (p * 14.0) + float2(_241.uSeed);
    int param_8 = 3;
    float _759 = fbm(param_7, param_8);
    float rag = edgeD + ((_759 - 0.5) * 0.039999999105930328369140625);
    float worn = 1.0 - smoothstep(0.0, 0.02999999932944774627685546875 + (0.0500000007450580596923828125 * _241.uWear), rag);
    col = mix(col, float3(0.920000016689300537109375, 0.88999998569488525390625, 0.800000011920928955078125), float3(worn * _241.uWear));
    float2 param_9 = fragCoord;
    col += float3((hash12(param_9) - 0.5) * 0.039999999105930328369140625);
    fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), pic.w);
}

fragment flair_aged_photo_frag_out flair_aged_photo_frag(constant FlairUniforms& _241 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_aged_photo_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _813;
    if (_241.flair_flipY > 0.5)
    {
        _813 = _241.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _813 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _813);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _241, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

