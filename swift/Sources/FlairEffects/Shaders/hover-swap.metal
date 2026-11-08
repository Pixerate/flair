// flair-metal-hash: e10abf09
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
    packed_float3 uEdge;
    float uEdgeWidth;
    float uGrain;
    uint uDemo;
    char _m17_pad[8];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_hover_swap_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float3 hoverPoint(thread const bool& demo, thread const float& idle, constant FlairUniforms& _203)
{
    float2 drift = float2(_203.iResolution[0], _203.iResolution[1]) * (float2(0.5) + float2(0.2800000011920928955078125 * sin(_203.iTime * 0.62999999523162841796875), 0.2199999988079071044921875 * sin((_203.iTime * 0.910000026226043701171875) + 1.2999999523162841796875)));
    float h = fast::clamp(_203.iPointer.z, 0.0, 1.0);
    return float3(mix(drift, _203.iPointer.xy, float2(h)), mix(demo ? idle : 0.0, 1.0, h));
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
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _203)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_203.uBackdrop) * _203.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_203.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _203)
{
    float4 _393;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _393 = overBackdrop(param, _203);
    }
    else
    {
        float2 param_1 = fract(uv);
        _393 = float4(testCard(param_1), 1.0);
    }
    return _393;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _203, texture2d<float> uFrom, sampler uFromSmplr, texture2d<float> uTo, sampler uToSmplr)
{
    float2 uv = fragCoord / float2(_203.iResolution[0], _203.iResolution[1]);
    bool param = _203.uDemo != 0u;
    float param_1 = 0.0;
    float3 hp = hoverPoint(param, param_1, _203);
    float h = fast::clamp(_203.iPointer.z, 0.0, 1.0);
    float _436;
    if (_203.uDemo != 0u)
    {
        _436 = smoothstep(0.100000001490116119384765625, 0.89999997615814208984375, 0.5 - (0.5 * cos(_203.iTime * 0.89999997615814208984375)));
    }
    else
    {
        _436 = 0.0;
    }
    float demo = _436;
    float progress = mix(demo, 1.0, h);
    float2 o = hp.xy / float2(_203.iResolution[1u]);
    float2 size = float2(_203.iResolution[0], _203.iResolution[1]) / float2(_203.iResolution[1u]);
    float far = fast::max(fast::max(length(o), length(o - float2(size.x, 0.0))), fast::max(length(o - float2(0.0, size.y)), length(o - size)));
    float dist = length((fragCoord / float2(_203.iResolution[1u])) - o) / far;
    float2 param_2 = (fragCoord / float2(_203.iResolution[1u])) * _203.uGrain;
    int param_3 = 5;
    float _518 = fbm(param_2, param_3);
    float f = (0.64999997615814208984375 * dist) + (0.3499999940395355224609375 * _518);
    float w = fast::max(_203.uEdgeWidth, 0.004999999888241291046142578125);
    float t = progress * (1.0 + w);
    float m = 1.0 - smoothstep(t - w, t, f);
    float2 param_4 = uv;
    float2 param_5 = uv;
    float4 col = mix(pictureRGBA(uFrom, uFromSmplr, param_4, _203), pictureRGBA(uTo, uToSmplr, param_5, _203), float4(m));
    float edge = ((m * (1.0 - m)) * 4.0) * step(0.001000000047497451305389404296875, _203.uEdgeWidth);
    fragColor = mix(col, float4(_203.uEdge[0], _203.uEdge[1], _203.uEdge[2], 1.0), float4(edge * 0.85000002384185791015625));
}

fragment flair_hover_swap_frag_out flair_hover_swap_frag(constant FlairUniforms& _203 [[buffer(0)]], texture2d<float> uFrom [[texture(1)]], texture2d<float> uTo [[texture(2)]], sampler uFromSmplr [[sampler(1)]], sampler uToSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_hover_swap_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _588;
    if (_203.flair_flipY > 0.5)
    {
        _588 = _203.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _588 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _588);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _203, uFrom, uFromSmplr, uTo, uToSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

