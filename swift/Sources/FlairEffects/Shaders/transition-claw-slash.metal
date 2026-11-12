// flair-metal-hash: 683f47d6
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
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
    uint uAnimate;
    float uProgress;
    char _m15_pad[8];
    packed_float3 uEdge;
    float uClaws;
    float uAngle;
    float uSpacing;
    char _m19_pad[8];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_transition_claw_slash_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float progress(constant FlairUniforms& _158)
{
    float _405;
    if (_158.uAnimate != 0u)
    {
        _405 = smoothstep(0.100000001490116119384765625, 0.89999997615814208984375, 0.5 - (0.5 * cos((_158.iTime * 6.28318023681640625) / 4.0)));
    }
    else
    {
        _405 = _158.uProgress;
    }
    return _405;
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
float2 fitCoverUV(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _158)
{
    int2 ts = int2(tex.get_width(), tex.get_height());
    bool _302 = ts.x <= 1;
    bool _309;
    if (!_302)
    {
        _309 = ts.y <= 1;
    }
    else
    {
        _309 = _302;
    }
    bool _316;
    if (!_309)
    {
        _316 = _158.iResolution[0u] <= 0.0;
    }
    else
    {
        _316 = _309;
    }
    bool _323;
    if (!_316)
    {
        _323 = _158.iResolution[1u] <= 0.0;
    }
    else
    {
        _323 = _316;
    }
    if (_323)
    {
        return uv;
    }
    float boxAspect = _158.iResolution[0u] / _158.iResolution[1u];
    float texAspect = float(ts.x) / float(ts.y);
    float2 _346;
    if (boxAspect > texAspect)
    {
        _346 = float2(1.0, texAspect / boxAspect);
    }
    else
    {
        _346 = float2(boxAspect / texAspect, 1.0);
    }
    float2 scale = _346;
    return ((uv - float2(0.5)) * scale) + float2(0.5);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _158)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_158.uBackdrop) * _158.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_158.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _158)
{
    float4 _373;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _373 = overBackdrop(param, _158);
    }
    else
    {
        float2 param_1 = fract(uv);
        _373 = float4(testCard(param_1), 1.0);
    }
    return _373;
}

static inline __attribute__((always_inline))
float4 pictureCoverRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _158)
{
    float2 param = uv;
    float2 param_1 = fitCoverUV(tex, texSmplr, param, _158);
    return pictureRGBA(tex, texSmplr, param_1, _158);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _158, texture2d<float> uFrom, sampler uFromSmplr, texture2d<float> uTo, sampler uToSmplr)
{
    float2 uv = fragCoord / float2(_158.iResolution[0], _158.iResolution[1]);
    float2 p = (fragCoord - (float2(_158.iResolution[0], _158.iResolution[1]) * 0.5)) / float2(_158.iResolution[1u]);
    float px = 1.0 / _158.iResolution[1u];
    float k = progress(_158);
    float a = radians(_158.uAngle);
    float2 dir = float2(cos(a), sin(a));
    float2 perp = float2(-dir.y, dir.x);
    int n = int(_158.uClaws + 0.5);
    float L = 2.2000000476837158203125;
    float nearest = 100000.0;
    float side = 0.0;
    float width = 0.0;
    for (int j = 0; j < 5; j++)
    {
        if (j >= n)
        {
            break;
        }
        float fj = float(j);
        float2 q = p - ((perp * (fj - (0.5 * float(n - 1)))) * _158.uSpacing);
        float s = dot(q, dir) / L;
        float across = dot(q, perp) - (((0.0599999986588954925537109375 * s) * s) * L);
        float reach = smoothstep(0.0199999995529651641845703125 * fj, 0.20000000298023223876953125 + (0.0199999995529651641845703125 * fj), k);
        bool _545 = (s < (-0.5)) || (s > 0.5);
        bool _553;
        if (!_545)
        {
            _553 = (s + 0.5) > reach;
        }
        else
        {
            _553 = _545;
        }
        if (_553)
        {
            continue;
        }
        float w = ((0.01200000010430812835693359375 * smoothstep(0.0, 0.20000000298023223876953125, k)) + ((0.60000002384185791015625 * _158.uSpacing) * smoothstep(0.25, 0.89999997615814208984375, k))) * powr(sin(3.141590118408203125 * (s + 0.5)), 0.4000000059604644775390625);
        float2 param = float2(s * 90.0, fj * 5.0);
        w *= (1.0 + (0.5 * (vnoise(param) - 0.5)));
        float d = abs(across) - w;
        if (d < nearest)
        {
            nearest = d;
            side = sign(across);
            width = w;
        }
    }
    float tear = fast::max(fast::clamp(0.5 - (nearest / px), 0.0, 1.0) * step(9.9999997473787516355514526367188e-06, width), smoothstep(0.800000011920928955078125, 1.0, k));
    float pull = (((width * 0.60000002384185791015625) * exp((-fast::max(nearest, 0.0)) / 0.0199999995529651641845703125)) * step(nearest, 0.0599999986588954925537109375)) * (1.0 - smoothstep(0.800000011920928955078125, 1.0, k));
    float2 param_1 = uv - (((perp * side) * pull) / float2(_158.iResolution[0u] / _158.iResolution[1u], 1.0));
    float4 from = pictureCoverRGBA(uFrom, uFromSmplr, param_1, _158);
    float2 param_2 = uv;
    float4 to = pictureCoverRGBA(uTo, uToSmplr, param_2, _158);
    float rim = ((1.0 - smoothstep(0.0, 0.007000000216066837310791015625, nearest)) * step(9.9999997473787516355514526367188e-06, width)) * (1.0 - smoothstep(0.800000011920928955078125, 1.0, k));
    float4 _674 = from;
    float4 _676 = from;
    float3 _688 = mix(_674.xyz, mix(_676.xyz, float3(_158.uEdge), float3(0.800000011920928955078125)), float3(rim * (1.0 - tear)));
    from.x = _688.x;
    from.y = _688.y;
    from.z = _688.z;
    float4 _711 = to;
    float3 _713 = _711.xyz * (1.0 - (((0.5 * exp((-fast::max(-nearest, 0.0)) / 0.014999999664723873138427734375)) * step(9.9999997473787516355514526367188e-06, width)) * (1.0 - smoothstep(0.800000011920928955078125, 1.0, k))));
    to.x = _713.x;
    to.y = _713.y;
    to.z = _713.z;
    fragColor = mix(from, to, float4(tear));
}

fragment flair_transition_claw_slash_frag_out flair_transition_claw_slash_frag(constant FlairUniforms& _158 [[buffer(0)]], texture2d<float> uFrom [[texture(1)]], texture2d<float> uTo [[texture(2)]], sampler uFromSmplr [[sampler(1)]], sampler uToSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_transition_claw_slash_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _736;
    if (_158.flair_flipY > 0.5)
    {
        _736 = _158.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _736 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _736);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _158, uFrom, uFromSmplr, uTo, uToSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

