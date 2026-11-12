// flair-metal-hash: 0ecbba3c
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
    float uFoil;
    float uGlare;
    float uTilt;
    float uCorner;
    packed_float3 uBorder;
    uint uDemo;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_holo_card_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float3 hoverPoint(thread const bool& demo, thread const float& idle, constant FlairUniforms& _166)
{
    float2 drift = float2(_166.iResolution[0], _166.iResolution[1]) * (float2(0.5) + float2(0.2800000011920928955078125 * sin(_166.iTime * 0.62999999523162841796875), 0.2199999988079071044921875 * sin((_166.iTime * 0.910000026226043701171875) + 1.2999999523162841796875)));
    float h = fast::clamp(_166.iPointer.z, 0.0, 1.0);
    return float3(mix(drift, _166.iPointer.xy, float2(h)), mix(demo ? idle : 0.0, 1.0, h));
}

static inline __attribute__((always_inline))
float roundedBox(thread const float2& p, thread const float2& hs, thread const float& r)
{
    float2 e = (abs(p) - hs) + float2(r);
    return (length(fast::max(e, float2(0.0))) + fast::min(fast::max(e.x, e.y), 0.0)) - r;
}

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _166)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_166.uBackdrop) * _166.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_166.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _166)
{
    float4 _396;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _396 = overBackdrop(param, _166);
    }
    else
    {
        float2 param_1 = fract(uv);
        _396 = float4(testCard(param_1), 1.0);
    }
    return _396;
}

static inline __attribute__((always_inline))
float3 picture(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _166)
{
    float2 param = uv;
    return pictureRGBA(tex, texSmplr, param, _166).xyz;
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
float4 unpremultiply(thread const float4& acc)
{
    return float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _166, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 res = float2(_166.iResolution[0], _166.iResolution[1]);
    float h = fast::min(res.y * 0.839999973773956298828125, (res.x * 0.839999973773956298828125) / 0.716000020503997802734375);
    float2 hs = float2(h * 0.716000020503997802734375, h) * 0.5;
    bool param = _166.uDemo != 0u;
    float param_1 = 0.699999988079071044921875;
    float3 hp = hoverPoint(param, param_1, _166);
    float2 tilt = (fast::clamp((hp.xy - (res * 0.5)) / hs, float2(-1.0), float2(1.0)) * hp.z) * _166.uTilt;
    float2 s = (fragCoord - (res * 0.5)) / hs;
    float2 q = s / float2(fast::max(1.0 - (0.1500000059604644775390625 * dot(s, tilt)), 0.20000000298023223876953125));
    float radius = (_166.uCorner * hs.x) * 2.0;
    float2 param_2 = q * hs;
    float2 param_3 = hs;
    float param_4 = radius;
    float sd = roundedBox(param_2, param_3, param_4);
    float mask = 1.0 - smoothstep(-1.0, 1.0, sd);
    float2 param_5 = ((fragCoord - (res * 0.5)) + ((tilt * hs) * 0.0599999986588954925537109375)) + float2(0.0, h * 0.02999999932944774627685546875);
    float2 param_6 = hs;
    float param_7 = radius;
    float shadowD = roundedBox(param_5, param_6, param_7);
    float shadow = (1.0 - smoothstep((-h) * 0.039999999105930328369140625, h * 0.0599999986588954925537109375, shadowD)) * 0.3499999940395355224609375;
    float4 param_8 = float4(0.0);
    float3 param_9 = float3(0.0);
    float param_10 = shadow * (1.0 - mask);
    float4 acc = over(param_8, param_9, param_10);
    if (mask > 0.0)
    {
        float2 cuv = (q * 0.5) + float2(0.5);
        float2 ts = float2(int2(uImage.get_width(), uImage.get_height()));
        float imageAspect = ts.x / fast::max(ts.y, 1.0);
        float2 _602;
        if (imageAspect > 0.716000020503997802734375)
        {
            _602 = float2(0.716000020503997802734375 / imageAspect, 1.0);
        }
        else
        {
            _602 = float2(1.0, imageAspect / 0.716000020503997802734375);
        }
        float2 fit = _602;
        float2 param_11 = float2(0.5) + ((cuv - float2(0.5)) * fit);
        float3 base = picture(uImage, uImageSmplr, param_11, _166);
        float2 param_12 = cuv * 5.0;
        float n = vnoise(param_12);
        float phase = (((dot(cuv, float2(0.699999988079071044921875, 1.10000002384185791015625)) * 1.60000002384185791015625) + (tilt.x * 0.89999997615814208984375)) - (tilt.y * 0.60000002384185791015625)) + (n * 0.5);
        float3 rainbow = float3(0.5) + (cos((float3(phase) + float3(0.0, 0.3300000131130218505859375, 0.670000016689300537109375)) * 6.28318023681640625) * 0.5);
        float lines = 0.75 + (0.25 * sin(((cuv.x - cuv.y) * 90.0) + (tilt.x * 8.0)));
        float band = exp((-powr((((cuv.x + cuv.y) * 0.699999988079071044921875) - 0.699999988079071044921875) - ((tilt.x + tilt.y) * 0.60000002384185791015625), 2.0)) * 6.0);
        float foil = (_166.uFoil * (0.25 + (0.75 * band))) * lines;
        float3 lit = mix((base * 2.0) * rainbow, float3(1.0) - (((float3(1.0) - base) * 2.0) * (float3(1.0) - rainbow)), step(float3(0.5), base));
        float3 col = mix(base, lit + (rainbow * 0.119999997317790985107421875), float3(foil * 0.75));
        float2 param_13 = floor(cuv * float2(90.0, 126.0));
        float sparkle = step(0.98500001430511474609375, hash12(param_13));
        col += float3(((sparkle * _166.uFoil) * band) * (0.5 + (0.5 * sin(((_166.iTime * 3.0) + (n * 20.0)) + (tilt.x * 10.0)))));
        float2 g = cuv - (float2(0.5) + (tilt * 0.550000011920928955078125));
        col += float3((_166.uGlare * 0.60000002384185791015625) * exp((-dot(g, g)) * 7.0));
        float border = smoothstep(((-0.02999999932944774627685546875) * h) - 1.0, (-0.02999999932944774627685546875) * h, sd);
        col = mix(col, float3(_166.uBorder) * (float3(0.800000011920928955078125) + ((rainbow * 0.4000000059604644775390625) * _166.uFoil)), float3(border));
        float4 param_14 = acc;
        float3 param_15 = fast::clamp(col, float3(0.0), float3(1.0));
        float param_16 = mask;
        acc = over(param_14, param_15, param_16);
    }
    float4 param_17 = acc;
    fragColor = unpremultiply(param_17);
}

fragment flair_holo_card_frag_out flair_holo_card_frag(constant FlairUniforms& _166 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_holo_card_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _846;
    if (_166.flair_flipY > 0.5)
    {
        _846 = _166.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _846 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _846);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _166, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

