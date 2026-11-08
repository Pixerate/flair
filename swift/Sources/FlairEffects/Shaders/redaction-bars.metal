// flair-metal-hash: 48e7bee8
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
    float2 uCentre;
    float2 uSize;
    int uLines;
    float uGap;
    char _m17_pad[8];
    packed_float3 uInk;
    float uRough;
    uint uAnimate;
    float uProgress;
    char _m21_pad[8];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_redaction_bars_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _146)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_146.uBackdrop) * _146.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_146.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _146)
{
    float4 _287;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _287 = overBackdrop(param, _146);
    }
    else
    {
        float2 param_1 = fract(uv);
        _287 = float4(testCard(param_1), 1.0);
    }
    return _287;
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _146, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param = fragCoord / float2(_146.iResolution[0], _146.iResolution[1]);
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _146);
    float t = mod(_146.iTime, 5.0);
    float _327;
    if (_146.uAnimate != 0u)
    {
        _327 = fast::clamp(t / 1.7999999523162841796875, 0.0, 1.0);
    }
    else
    {
        _327 = _146.uProgress;
    }
    float drawn = _327;
    float _343;
    if (_146.uAnimate != 0u)
    {
        _343 = smoothstep(4.19999980926513671875, 4.900000095367431640625, t);
    }
    else
    {
        _343 = 0.0;
    }
    float wiped = _343;
    float2 hs = (_146.uSize * 0.5) * float2(_146.iResolution[0], _146.iResolution[1]);
    float2 lo = (_146.uCentre * float2(_146.iResolution[0], _146.iResolution[1])) - hs;
    float lines = float(max(_146.uLines, 1));
    float h = (2.0 * hs.y) / (lines + ((lines - 1.0) * _146.uGap));
    float pitch = h * (1.0 + _146.uGap);
    float down = (lo.y + (2.0 * hs.y)) - fragCoord.y;
    float i = floor(down / pitch);
    float across = down - (i * pitch);
    float along = fragCoord.x - lo.x;
    float ink = 0.0;
    bool _431 = (i >= 0.0) && (i < lines);
    bool _437;
    if (_431)
    {
        _437 = hs.x > 0.0;
    }
    else
    {
        _437 = _431;
    }
    if (_437)
    {
        float _451;
        if ((i == (lines - 1.0)) && (lines > 1.0))
        {
            _451 = 0.62000000476837158203125;
        }
        else
        {
            float2 param_1 = float2(i, 4.099999904632568359375);
            _451 = 1.0 - (0.14000000059604644775390625 * hash12(param_1));
        }
        float len = (2.0 * hs.x) * _451;
        float k = fast::clamp((drawn * ((lines * 0.5) + 0.5)) - (i * 0.5), 0.0, 1.0);
        k = 1.0 - ((1.0 - k) * (1.0 - k));
        float wob = (_146.uRough * h) * 0.119999997317790985107421875;
        float2 param_2 = float2(along / 23.0, i * 7.30000019073486328125);
        float top = ((vnoise(param_2) - 0.5) * 2.0) * wob;
        float2 param_3 = float2(along / 19.0, (i * 3.099999904632568359375) + 40.0);
        float bottom = h + (((vnoise(param_3) - 0.5) * 2.0) * wob);
        float2 param_4 = float2(across / 9.0, (i * 5.69999980926513671875) + 80.0);
        float endWob = ((vnoise(param_4) - 0.5) * 6.0) * wob;
        float start = (wiped * len) + endWob;
        float end = (k * len) - endWob;
        ink = (((smoothstep(top - 0.5, top + 0.5, across) * smoothstep(bottom + 0.5, bottom - 0.5, across)) * smoothstep(start - 0.5, start + 0.5, along)) * smoothstep(end + 0.5, end - 0.5, along)) * step(0.001000000047497451305389404296875, k);
    }
    float2 param_5 = float2(fragCoord.x / 70.0, fragCoord.y / 2.5);
    float3 bar = float3(_146.uInk) + float3((_146.uRough * 0.07999999821186065673828125) * vnoise(param_5));
    fragColor = float4(mix(pic.xyz, bar, float3(ink)), fast::max(pic.w, ink));
}

fragment flair_redaction_bars_frag_out flair_redaction_bars_frag(constant FlairUniforms& _146 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_redaction_bars_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _624;
    if (_146.flair_flipY > 0.5)
    {
        _624 = _146.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _624 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _624);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _146, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

