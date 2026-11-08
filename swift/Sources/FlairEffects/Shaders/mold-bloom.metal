// flair-metal-hash: 9a831e6a
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
    float3 uColor;
    float3 uFur;
    packed_float3 uCore;
    float uColonies;
    float uSize;
    float uCycle;
    uint uAnimate;
    float uProgress;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_mold_bloom_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _178)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_178.uBackdrop) * _178.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_178.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _178)
{
    float4 _319;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _319 = overBackdrop(param, _178);
    }
    else
    {
        float2 param_1 = fract(uv);
        _319 = float4(testCard(param_1), 1.0);
    }
    return _319;
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _178, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_178.iResolution[0], _178.iResolution[1]);
    float aspect = _178.iResolution[0u] / _178.iResolution[1u];
    float2 p = (fragCoord - (float2(_178.iResolution[0], _178.iResolution[1]) * 0.5)) / float2(_178.iResolution[1u]);
    float u = fract(_178.iTime / _178.uCycle);
    float _376;
    if (_178.uAnimate != 0u)
    {
        _376 = smoothstep(0.0, 0.85000002384185791015625, u);
    }
    else
    {
        _376 = _178.uProgress;
    }
    float k = _376;
    float _391;
    if (_178.uAnimate != 0u)
    {
        _391 = smoothstep(0.89999997615814208984375, 1.0, u);
    }
    else
    {
        _391 = 0.0;
    }
    float back = _391;
    float2 param = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _178);
    float3 col = pic.xyz;
    float cover = 0.0;
    int n = int(_178.uColonies + 0.5);
    for (int i = 0; i < 30; i++)
    {
        if (i >= n)
        {
            break;
        }
        float fi = float(i);
        float2 param_1 = float2(fi * 5.30000019073486328125, 2.900000095367431640625);
        float2 h = hash22(param_1);
        float2 c = (h - float2(0.5)) * float2(aspect * 0.949999988079071044921875, 0.949999988079071044921875);
        float2 param_2 = float2(fi, 4.099999904632568359375);
        float start = 0.60000002384185791015625 * hash12(param_2);
        float grow = powr(fast::clamp((k - start) / (1.0 - start), 0.0, 1.0), 0.699999988079071044921875);
        float r = (_178.uSize * (0.4000000059604644775390625 + (0.800000011920928955078125 * fract(h.x * 17.0)))) * grow;
        float dc = length(p - c);
        bool _489 = r < 9.9999997473787516355514526367188e-05;
        bool _498;
        if (!_489)
        {
            _498 = dc > (1.7999999523162841796875 * r);
        }
        else
        {
            _498 = _489;
        }
        if (_498)
        {
            continue;
        }
        col *= mix(float3(1.0), float3(0.930000007152557373046875, 0.86000001430511474609375, 0.62000000476837158203125), float3((1.0 - smoothstep(r, 1.7000000476837158203125 * r, dc)) * 0.800000011920928955078125));
        float2 param_3 = (p * 60.0) + float2(fi * 7.0);
        float d = dc + (((vnoise(param_3) - 0.5) * 0.3499999940395355224609375) * r);
        float inside = 1.0 - smoothstep(0.85000002384185791015625 * r, r, d);
        float x = fast::clamp(d / r, 0.0, 1.0);
        float3 m = mix(float3(_178.uCore), _178.uColor, float3(smoothstep(0.0, 0.550000011920928955078125, x)));
        m *= (0.85000002384185791015625 + (0.1500000059604644775390625 * sin(x * 22.0)));
        float2 param_4 = p * 140.0;
        m = mix(m, _178.uFur, float3(smoothstep(0.64999997615814208984375, 0.980000019073486328125, x) * (0.60000002384185791015625 + (0.4000000059604644775390625 * vnoise(param_4)))));
        col = mix(col, m, float3(inside * 0.949999988079071044921875));
        cover = fast::max(cover, inside);
    }
    col = mix(col, pic.xyz, float3(back));
    fragColor = float4(col, fast::max(pic.w, cover * (1.0 - back)));
}

fragment flair_mold_bloom_frag_out flair_mold_bloom_frag(constant FlairUniforms& _178 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_mold_bloom_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _625;
    if (_178.flair_flipY > 0.5)
    {
        _625 = _178.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _625 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _625);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _178, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

