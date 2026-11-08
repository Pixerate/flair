// flair-metal-hash: fd1bb9d4
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
    uint uAnimate;
    float uProgress;
    float uCurl;
    char _m16_pad[4];
    packed_float3 uBack;
    float uShowThrough;
    float uShadow;
    char _m19_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_sticker_peel_reveal_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float flapMargin(thread const float2& pos, thread const float2& corner, thread const float2& dir, thread const float& aspect, thread const float& fold, thread const float& r, thread float& s, thread float2& orig)
{
    float t = dot(pos - corner, dir);
    s = t - fold;
    float _241;
    if (s < r)
    {
        _241 = r * asin(fast::clamp(s / r, 0.0, 1.0));
    }
    else
    {
        _241 = (r * 1.57079994678497314453125) + (s - r);
    }
    float l = _241;
    orig = pos + (dir * ((fold - l) - t));
    float m = fast::min(fast::min(orig.x, aspect - orig.x), fast::min(orig.y, 1.0 - orig.y));
    return fast::min(m, s);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _64)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_64.uBackdrop) * _64.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_64.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _64)
{
    float4 _208;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _208 = overBackdrop(param, _64);
    }
    else
    {
        float2 param_1 = fract(uv);
        _208 = float4(testCard(param_1), 1.0);
    }
    return _208;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _64, texture2d<float> uFrom, sampler uFromSmplr, texture2d<float> uTo, sampler uToSmplr)
{
    float2 res = float2(_64.iResolution[0], _64.iResolution[1]);
    float aspect = res.x / res.y;
    float _306;
    if (_64.uAnimate != 0u)
    {
        _306 = smoothstep(0.100000001490116119384765625, 0.89999997615814208984375, 0.5 - (0.5 * cos((_64.iTime * 6.28318023681640625) / 4.0)));
    }
    else
    {
        _306 = _64.uProgress;
    }
    float p = _306;
    float2 pos = fragCoord / float2(res.y);
    float2 corner = float2(aspect, 0.0);
    float2 dir = fast::normalize(float2(-aspect, 1.0));
    float r = _64.uCurl;
    float fold = p * (length(float2(aspect, 1.0)) + (r * 2.2000000476837158203125));
    float2 param = pos;
    float2 param_1 = corner;
    float2 param_2 = dir;
    float param_3 = aspect;
    float param_4 = fold;
    float param_5 = r;
    float param_6;
    float2 param_7;
    float _371 = flapMargin(param, param_1, param_2, param_3, param_4, param_5, param_6, param_7);
    float s = param_6;
    float2 orig = param_7;
    float m = _371;
    float2 uv = fragCoord / res;
    float4 _381;
    if (s > 0.0)
    {
        float2 param_8 = uv;
        _381 = pictureRGBA(uFrom, uFromSmplr, param_8, _64);
    }
    else
    {
        float2 param_9 = uv;
        _381 = pictureRGBA(uTo, uToSmplr, param_9, _64);
    }
    float4 col = _381;
    float soft = 0.01200000010430812835693359375 + (0.119999997317790985107421875 * r);
    float2 param_10 = pos - (float2(0.5, -0.800000011920928955078125) * soft);
    float2 param_11 = corner;
    float2 param_12 = dir;
    float param_13 = aspect;
    float param_14 = fold;
    float param_15 = r;
    float param_16;
    float2 param_17;
    float _421 = flapMargin(param_10, param_11, param_12, param_13, param_14, param_15, param_16, param_17);
    float s2 = param_16;
    float2 o2 = param_17;
    float m2 = _421;
    float shadow = ((smoothstep(-soft, soft, m2) * _64.uShadow) * 0.60000002384185791015625) * smoothstep(0.0, 0.02999999932944774627685546875, p);
    float _443;
    if (s < 0.0)
    {
        _443 = ((exp(s / ((0.3499999940395355224609375 * r) + 0.00999999977648258209228515625)) * _64.uShadow) * 0.449999988079071044921875) * smoothstep(0.0, 0.02999999932944774627685546875, p);
    }
    else
    {
        _443 = 0.0;
    }
    float crease = _443;
    float4 _468 = col;
    float3 _470 = _468.xyz * (1.0 - fast::max(shadow, crease));
    col.x = _470.x;
    col.y = _470.y;
    col.z = _470.z;
    float flap = smoothstep((-1.0) / res.y, 1.0 / res.y, m);
    if (flap > 0.0)
    {
        float2 param_18 = orig / float2(aspect, 1.0);
        float3 back = mix(float3(_64.uBack), pictureRGBA(uFrom, uFromSmplr, param_18, _64).xyz, float3(_64.uShowThrough));
        float x = fast::clamp(s / r, 0.0, 3.0);
        float light = (0.680000007152557373046875 + (0.4199999868869781494140625 * smoothstep(0.0, 0.60000002384185791015625, x))) - (0.100000001490116119384765625 * smoothstep(0.60000002384185791015625, 1.7999999523162841796875, x));
        light += (0.2199999988079071044921875 * exp(-powr((x - 0.550000011920928955078125) / 0.14000000059604644775390625, 2.0)));
        col = mix(col, float4(fast::clamp(back * light, float3(0.0), float3(1.0)), 1.0), float4(flap));
    }
    fragColor = col;
}

fragment flair_sticker_peel_reveal_frag_out flair_sticker_peel_reveal_frag(constant FlairUniforms& _64 [[buffer(0)]], texture2d<float> uFrom [[texture(1)]], texture2d<float> uTo [[texture(2)]], sampler uFromSmplr [[sampler(1)]], sampler uToSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_sticker_peel_reveal_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _565;
    if (_64.flair_flipY > 0.5)
    {
        _565 = _64.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _565 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _565);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _64, uFrom, uFromSmplr, uTo, uToSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

