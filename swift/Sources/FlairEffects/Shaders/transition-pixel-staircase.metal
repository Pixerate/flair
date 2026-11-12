// flair-metal-hash: e87868d6
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
    uint uAnimate;
    float uProgress;
    int uPattern;
    float uBlock;
    float uSpread;
    float uSteps;
    uint uReverse;
    float3 uFill;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_transition_pixel_staircase_frag_out
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
float order(thread const float2& b, thread const float2& g, constant FlairUniforms& _97)
{
    if (_97.uPattern == 0)
    {
        return (b.x + ((g.y - 1.0) - b.y)) / fast::max((g.x + g.y) - 2.0, 1.0);
    }
    if (_97.uPattern == 1)
    {
        float ring = fast::min(fast::min(b.x, b.y), fast::min((g.x - 1.0) - b.x, (g.y - 1.0) - b.y));
        float rings = floor((fast::min(g.x, g.y) + 1.0) / 2.0);
        float2 d = b - ((g - float2(1.0)) * 0.5);
        float turn = fract((precise::atan2(d.y, d.x) / 6.28318023681640625) + 0.25);
        return fast::clamp((ring + turn) / rings, 0.0, 1.0);
    }
    if (_97.uPattern == 2)
    {
        return fast::clamp(1.0 - (length((b + float2(0.5)) - (g * 0.5)) / length(g * 0.5)), 0.0, 1.0);
    }
    float2 param = b + float2(0.5);
    return hash12(param);
}

static inline __attribute__((always_inline))
float grown(thread const float& u, thread const float& o, constant FlairUniforms& _97)
{
    float w = fast::min(_97.uSpread, 0.89999997615814208984375);
    float k = fast::clamp((u - (o * w)) / (1.0 - w), 0.0, 1.0);
    return floor(k * _97.uSteps) / _97.uSteps;
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _97)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_97.uBackdrop) * _97.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_97.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _97)
{
    float4 _239;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _239 = overBackdrop(param, _97);
    }
    else
    {
        float2 param_1 = fract(uv);
        _239 = float4(testCard(param_1), 1.0);
    }
    return _239;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _97, texture2d<float> uFrom, sampler uFromSmplr, texture2d<float> uTo, sampler uToSmplr)
{
    float _405;
    if (_97.uAnimate != 0u)
    {
        _405 = smoothstep(0.0500000007450580596923828125, 0.949999988079071044921875, 0.5 - (0.5 * cos((_97.iTime * 6.28318023681640625) / 4.0)));
    }
    else
    {
        _405 = _97.uProgress;
    }
    float p = _405;
    float2 g = ceil(float2(_97.iResolution[0], _97.iResolution[1]) / float2(_97.uBlock));
    float2 b = floor(fragCoord / float2(_97.uBlock));
    float2 f = ((fragCoord / float2(_97.uBlock)) - b) - float2(0.5);
    float m = fast::max(abs(f.x), abs(f.y));
    float2 param = b;
    float2 param_1 = g;
    float o = order(param, param_1, _97);
    float2 uv = fragCoord / float2(_97.iResolution[0], _97.iResolution[1]);
    bool covered;
    float4 under;
    if (p < 0.5)
    {
        float param_2 = p * 2.0;
        float param_3 = o;
        float k = grown(param_2, param_3, _97);
        bool _485 = k >= 1.0;
        bool _493;
        if (!_485)
        {
            _493 = m < (k * 0.5);
        }
        else
        {
            _493 = _485;
        }
        covered = _493;
        float2 param_4 = uv;
        under = pictureRGBA(uFrom, uFromSmplr, param_4, _97);
    }
    else
    {
        float _508;
        if (_97.uReverse != 0u)
        {
            _508 = 1.0 - o;
        }
        else
        {
            _508 = o;
        }
        float param_5 = (p * 2.0) - 1.0;
        float param_6 = _508;
        float k_1 = grown(param_5, param_6, _97);
        bool _520 = k_1 <= 0.0;
        bool _529;
        if (!_520)
        {
            _529 = m < ((1.0 - k_1) * 0.5);
        }
        else
        {
            _529 = _520;
        }
        covered = _529;
        float2 param_7 = uv;
        under = pictureRGBA(uTo, uToSmplr, param_7, _97);
    }
    float4 _535;
    if (covered)
    {
        _535 = float4(_97.uFill, 1.0);
    }
    else
    {
        _535 = under;
    }
    fragColor = _535;
}

fragment flair_transition_pixel_staircase_frag_out flair_transition_pixel_staircase_frag(constant FlairUniforms& _97 [[buffer(0)]], texture2d<float> uFrom [[texture(1)]], texture2d<float> uTo [[texture(2)]], sampler uFromSmplr [[sampler(1)]], sampler uToSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_transition_pixel_staircase_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _560;
    if (_97.flair_flipY > 0.5)
    {
        _560 = _97.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _560 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _560);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _97, uFrom, uFromSmplr, uTo, uToSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

