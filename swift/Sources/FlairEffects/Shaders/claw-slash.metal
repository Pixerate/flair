// flair-metal-hash: 6836323a
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

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
    float3 uInside;
    packed_float3 uEdge;
    float uClaws;
    float uAngle;
    float uWidth;
    float uSpacing;
    float uCycle;
    uint uAnimate;
    float uProgress;
    char _m22_pad[8];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_claw_slash_frag_out
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _146, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_146.iResolution[0], _146.iResolution[1]);
    float2 p = (fragCoord - (float2(_146.iResolution[0], _146.iResolution[1]) * 0.5)) / float2(_146.iResolution[1u]);
    float _330;
    if (_146.uAnimate != 0u)
    {
        _330 = fract(_146.iTime / _146.uCycle);
    }
    else
    {
        _330 = _146.uProgress;
    }
    float k = _330;
    float _349;
    if (_146.uAnimate != 0u)
    {
        _349 = 1.0 - smoothstep(0.699999988079071044921875, 0.949999988079071044921875, k);
    }
    else
    {
        _349 = 1.0;
    }
    float heal = _349;
    float a = radians(_146.uAngle);
    float2 dir = float2(cos(a), sin(a));
    float2 perp = float2(-dir.y, dir.x);
    int n = int(_146.uClaws + 0.5);
    float L = 0.85000002384185791015625;
    float nearest = 100000.0;
    float width = 0.0;
    float side = 0.0;
    for (int j = 0; j < 5; j++)
    {
        if (j >= n)
        {
            break;
        }
        float fj = float(j);
        float2 c = ((perp * (fj - (0.5 * float(n - 1)))) * _146.uSpacing) + ((dir * 0.02999999932944774627685546875) * (fj - 1.5));
        float2 q = p - c;
        float s = dot(q, dir) / L;
        float across = dot(q, perp) - (((0.07999999821186065673828125 * s) * s) * L);
        float start = 0.0199999995529651641845703125 * fj;
        float reach = smoothstep(start, start + 0.07999999821186065673828125, k);
        bool _464 = (s < (-0.5)) || (s > 0.5);
        bool _472;
        if (!_464)
        {
            _472 = (s + 0.5) > reach;
        }
        else
        {
            _472 = _464;
        }
        if (_472)
        {
            continue;
        }
        float2 param = float2(s * 70.0, fj * 5.0);
        float w = (((_146.uWidth * 0.001000000047497451305389404296875) * powr(sin(3.141590118408203125 * (s + 0.5)), 0.60000002384185791015625)) * (1.0 + (0.5 * (vnoise(param) - 0.5)))) * heal;
        float d = abs(across) - w;
        if (d < nearest)
        {
            nearest = d;
            width = w;
            side = sign(across);
        }
    }
    float pull = ((width * 0.89999997615814208984375) * exp((-fast::max(nearest, 0.0)) / 0.0199999995529651641845703125)) * step(nearest, 0.0599999986588954925537109375);
    float2 param_1 = uv - (((perp * side) * pull) / float2(_146.iResolution[0u] / _146.iResolution[1u], 1.0));
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_1, _146);
    float3 col = pic.xyz;
    float px = 1.0 / _146.iResolution[1u];
    float rim = (1.0 - smoothstep(0.0, (0.006000000052154064178466796875 * heal) + px, nearest)) * step(9.9999997473787516355514526367188e-06, width);
    float tear = fast::clamp(0.5 - (nearest / px), 0.0, 1.0) * step(9.9999997473787516355514526367188e-06, width);
    col = mix(col, mix(col, float3(_146.uEdge), float3(0.75)), float3(rim));
    float3 inside = _146.uInside * (0.60000002384185791015625 + (0.4000000059604644775390625 * fast::clamp((-nearest) / fast::max(width, 9.9999997473787516355514526367188e-05), 0.0, 1.0)));
    col = mix(col, inside, float3(tear));
    col *= (1.0 - (((0.3499999940395355224609375 * exp((-fast::max(nearest, 0.0)) / 0.0040000001899898052215576171875)) * step(9.9999997473787516355514526367188e-06, width)) * (1.0 - tear)));
    fragColor = float4(col, fast::max(pic.w, tear));
}

fragment flair_claw_slash_frag_out flair_claw_slash_frag(constant FlairUniforms& _146 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_claw_slash_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _648;
    if (_146.flair_flipY > 0.5)
    {
        _648 = _146.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _648 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _648);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _146, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

