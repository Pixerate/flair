// flair-metal-hash: 143eb23c
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
    float uScale;
    float uEdge;
    float3 uInk;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_transition_ink_bleed_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float progress(constant FlairUniforms& _247)
{
    float _409;
    if (_247.uAnimate != 0u)
    {
        _409 = smoothstep(0.100000001490116119384765625, 0.89999997615814208984375, 0.5 - (0.5 * cos((_247.iTime * 6.28318023681640625) / 4.0)));
    }
    else
    {
        _409 = _247.uProgress;
    }
    return _409;
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
float2 coverScale(texture2d<float> tex, sampler texSmplr, constant FlairUniforms& _247)
{
    float2 size = float2(int2(tex.get_width(), tex.get_height()));
    float frameAspect = _247.iResolution[0u] / _247.iResolution[1u];
    float _446;
    if (size.x > 1.0)
    {
        _446 = size.x / size.y;
    }
    else
    {
        _446 = frameAspect;
    }
    float imageAspect = _446;
    float2 _460;
    if (frameAspect > imageAspect)
    {
        _460 = float2(1.0, imageAspect / frameAspect);
    }
    else
    {
        _460 = float2(frameAspect / imageAspect, 1.0);
    }
    return _460;
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _247)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_247.uBackdrop) * _247.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_247.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _247)
{
    float4 _384;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _384 = overBackdrop(param, _247);
    }
    else
    {
        float2 param_1 = fract(uv);
        _384 = float4(testCard(param_1), 1.0);
    }
    return _384;
}

static inline __attribute__((always_inline))
float4 coverRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _247)
{
    float2 param = float2(0.5) + ((uv - float2(0.5)) * coverScale(tex, texSmplr, _247));
    return pictureRGBA(tex, texSmplr, param, _247);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _247, texture2d<float> uFrom, sampler uFromSmplr, texture2d<float> uTo, sampler uToSmplr)
{
    float2 uv = fragCoord / float2(_247.iResolution[0], _247.iResolution[1]);
    float t = progress(_247);
    float2 q = fragCoord / float2(_247.iResolution[1u]);
    float2 param = q * _247.uScale;
    int param_1 = 5;
    float _510 = fbm(param, param_1);
    float2 param_2 = (q * _247.uScale) + float2(31.700000762939453125);
    int param_3 = 5;
    float _520 = fbm(param_2, param_3);
    float2 warped = q + ((float2(_510, _520) - float2(0.5)) * 0.3499999940395355224609375);
    float aspect = _247.iResolution[0u] / _247.iResolution[1u];
    float near = 1000000000.0;
    for (int i = 0; i < 4; i++)
    {
        float2 param_4 = float2(float(i), 3.7000000476837158203125);
        float2 h = hash22(param_4);
        float2 seed = float2((((float(i) + 0.20000000298023223876953125) + (0.60000002384185791015625 * h.x)) / 4.0) * aspect, 0.20000000298023223876953125 + (0.60000002384185791015625 * h.y));
        near = fast::min(near, length(warped - seed));
    }
    float2 param_5 = (q * _247.uScale) * 4.0;
    int param_6 = 4;
    float _589 = fbm(param_5, param_6);
    float2 param_7 = (q * _247.uScale) * 18.0;
    float v = fast::clamp((((near / 0.5) * 0.75) + (0.25 * _589)) + (0.0599999986588954925537109375 * (vnoise(param_7) - 0.5)), 0.0, 1.0);
    float front = mix(((-2.0) * _247.uEdge) - 0.0199999995529651641845703125, (1.0 + (2.0 * _247.uEdge)) + 0.0199999995529651641845703125, t);
    float gap = front - v;
    float wet = smoothstep((-_247.uEdge) * 0.300000011920928955078125, _247.uEdge * 0.300000011920928955078125, gap);
    float soak = smoothstep((-2.0) * _247.uEdge, 0.0, gap) * (1.0 - wet);
    float pool = wet * smoothstep(_247.uEdge, 0.0, gap);
    float2 bleed = float2(soak - pool) * 0.0040000001899898052215576171875;
    float2 param_8 = uv + bleed;
    float2 param_9 = uv - bleed;
    float4 col = mix(coverRGBA(uFrom, uFromSmplr, param_8, _247), coverRGBA(uTo, uToSmplr, param_9, _247), float4(wet));
    float4 _673 = col;
    float4 _675 = col;
    float3 _682 = mix(_673.xyz, _675.xyz * 0.819999992847442626953125, float3(soak * 0.60000002384185791015625));
    col.x = _682.x;
    col.y = _682.y;
    col.z = _682.z;
    col = mix(col, float4(_247.uInk, 1.0), float4(pool * 0.85000002384185791015625));
    fragColor = col;
}

fragment flair_transition_ink_bleed_frag_out flair_transition_ink_bleed_frag(constant FlairUniforms& _247 [[buffer(0)]], texture2d<float> uFrom [[texture(1)]], texture2d<float> uTo [[texture(2)]], sampler uFromSmplr [[sampler(1)]], sampler uToSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_transition_ink_bleed_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _714;
    if (_247.flair_flipY > 0.5)
    {
        _714 = _247.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _714 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _714);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _247, uFrom, uFromSmplr, uTo, uToSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

