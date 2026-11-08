// flair-metal-hash: 9f4736a8
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
    float uSize;
    float uBevel;
    float uRefraction;
    float uDispersion;
    float uFrost;
    float uRough;
    char _m19_pad[8];
    packed_float3 uTint;
    float uTintAlpha;
    float uGloss;
    float uShadow;
    float uDim;
    float uBeam;
    packed_float3 uBeamColor;
    float uBeamWidth;
    float uBeamAngle;
    float uSweepTime;
    float uPrism;
    char _m30_pad[4];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_glass_text_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float3 textPlace(thread const float2& p, constant FlairUniforms& _214, texture2d<float> uText, sampler uTextSmplr)
{
    float2 size = float2(int2(uText.get_width(), uText.get_height()));
    float aspect = size.x / fast::max(size.y, 1.0);
    float h = fast::min(_214.uSize, ((_214.iResolution[0u] / _214.iResolution[1u]) * _214.uSize) / aspect);
    return float3((p / float2(h * aspect, h)) + float2(0.5), size.y / h);
}

static inline __attribute__((always_inline))
float textAt(thread const float2& p, thread const float& blur, constant FlairUniforms& _214, texture2d<float> uText, sampler uTextSmplr)
{
    float2 param = p;
    float3 m = textPlace(param, _214, uText, uTextSmplr);
    bool _510 = m.x < 0.0;
    bool _517;
    if (!_510)
    {
        _517 = m.x > 1.0;
    }
    else
    {
        _517 = _510;
    }
    bool _524;
    if (!_517)
    {
        _524 = m.y < 0.0;
    }
    else
    {
        _524 = _517;
    }
    bool _531;
    if (!_524)
    {
        _531 = m.y > 1.0;
    }
    else
    {
        _531 = _524;
    }
    if (_531)
    {
        return 0.0;
    }
    return uText.sample(uTextSmplr, m.xy, level(log2(fast::max(blur * m.z, 1.0)))).w;
}

static inline __attribute__((always_inline))
float bevelHeight(thread const float2& p, thread const float& bevel, constant FlairUniforms& _214, texture2d<float> uText, sampler uTextSmplr)
{
    float2 param = p;
    float param_1 = bevel * 0.5;
    float2 param_2 = p;
    float param_3 = bevel;
    float2 param_4 = p;
    float param_5 = bevel * 2.0;
    return ((0.449999988079071044921875 * textAt(param, param_1, _214, uText, uTextSmplr)) + (0.3499999940395355224609375 * textAt(param_2, param_3, _214, uText, uTextSmplr))) + (0.20000000298023223876953125 * textAt(param_4, param_5, _214, uText, uTextSmplr));
}

static inline __attribute__((always_inline))
float2 bevelSlope(thread const float2& p, thread const float& bevel, constant FlairUniforms& _214, texture2d<float> uText, sampler uTextSmplr)
{
    float e = bevel * 0.3499999940395355224609375;
    float2 param = p + float2(e, 0.0);
    float param_1 = bevel;
    float2 param_2 = p - float2(e, 0.0);
    float param_3 = bevel;
    float2 param_4 = p + float2(0.0, e);
    float param_5 = bevel;
    float2 param_6 = p - float2(0.0, e);
    float param_7 = bevel;
    float2 d = float2(bevelHeight(param, param_1, _214, uText, uTextSmplr) - bevelHeight(param_2, param_3, _214, uText, uTextSmplr), bevelHeight(param_4, param_5, _214, uText, uTextSmplr) - bevelHeight(param_6, param_7, _214, uText, uTextSmplr));
    return (d / float2(2.0 * e)) * bevel;
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
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _214)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_214.uBackdrop) * _214.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_214.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float4 pictureBlurRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, thread const float& blurPx, constant FlairUniforms& _214)
{
    float2 size = float2(int2(tex.get_width(), tex.get_height()));
    if (size.x <= 1.0)
    {
        float2 param = fract(uv);
        return float4(testCard(param), 1.0);
    }
    float4 param_1 = tex.sample(texSmplr, uv, level(log2(fast::max((blurPx * size.x) / _214.iResolution[0u], 1.0))));
    return overBackdrop(param_1, _214);
}

static inline __attribute__((always_inline))
float3 spectrum(thread const float& x)
{
    float3 d = (float3(x) - float3(0.20000000298023223876953125, 0.5, 0.800000011920928955078125)) / float3(0.300000011920928955078125);
    float3 c = fast::clamp(float3(1.0) - (d * d), float3(0.0), float3(1.0));
    c.x += (0.3499999940395355224609375 * fast::clamp(1.0 - (((x - 0.949999988079071044921875) * (x - 0.949999988079071044921875)) / 0.022500000894069671630859375), 0.0, 1.0));
    return c;
}

static inline __attribute__((always_inline))
float4 dispersed(texture2d<float> tex, sampler texSmplr, thread const float2& uv, thread const float2& shift, thread const float& blurPx, constant FlairUniforms& _214)
{
    if (dot(shift, shift) < 9.9999999600419720025001879548654e-13)
    {
        float2 param = uv;
        float param_1 = blurPx;
        return pictureBlurRGBA(tex, texSmplr, param, param_1, _214);
    }
    float3 sum = float3(0.0);
    float3 weight = float3(0.0);
    float alpha = 0.0;
    for (int i = 0; i < 5; i++)
    {
        float x = (float(i) + 0.5) / 5.0;
        float param_2 = x;
        float3 w = spectrum(param_2);
        float2 param_3 = uv + (shift * (x - 0.5));
        float param_4 = blurPx;
        float4 c = pictureBlurRGBA(tex, texSmplr, param_3, param_4, _214);
        sum += (c.xyz * w);
        weight += w;
        alpha += c.w;
    }
    return float4(sum / weight, alpha / 5.0);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _214, texture2d<float> uText, sampler uTextSmplr, texture2d<float> uImage, sampler uImageSmplr)
{
    float px = 1.0 / _214.iResolution[1u];
    float2 p = (fragCoord - (float2(_214.iResolution[0], _214.iResolution[1]) * 0.5)) * px;
    float2 uv = fragCoord / float2(_214.iResolution[0], _214.iResolution[1]);
    float2 toUv = float2(_214.iResolution[1u] / _214.iResolution[0u], 1.0);
    float2 param = p;
    float param_1 = 1.5 * px;
    float mask = textAt(param, param_1, _214, uText, uTextSmplr);
    float2 param_2 = p;
    float param_3 = _214.uBevel;
    float h = bevelHeight(param_2, param_3, _214, uText, uTextSmplr);
    float2 param_4 = p;
    float param_5 = _214.uBevel;
    float2 s = bevelSlope(param_4, param_5, _214, uText, uTextSmplr);
    if (_214.uRough > 0.0)
    {
        float2 q = p * 60.0;
        float2 param_6 = q;
        float2 param_7 = q + float2(0.5, 0.0);
        float2 param_8 = q;
        float2 param_9 = q + float2(0.0, 0.5);
        s += (((float2(vnoise(param_6) - vnoise(param_7), vnoise(param_8) - vnoise(param_9)) * (_214.uRough * 0.5)) * 2.0) * h);
    }
    float slope = length(s);
    float rim = smoothstep(0.100000001490116119384765625, 0.800000011920928955078125, slope);
    float ba = radians(_214.uBeamAngle);
    float2 across = float2(cos(ba), sin(ba));
    float2 along = float2(sin(ba), -cos(ba));
    float reach = ((0.5 * _214.iResolution[0u]) * px) + (_214.uBeamWidth * 2.5);
    float phase = fract(_214.iTime / _214.uSweepTime);
    float d = dot(p, across) - mix(-reach, reach, fast::clamp(phase / 0.699999988079071044921875, 0.0, 1.0));
    float beam = (_214.uBeam * exp(((-d) * d) / (_214.uBeamWidth * _214.uBeamWidth))) * step(phase, 0.699999988079071044921875);
    float2 param_10 = uv;
    float param_11 = 1.0;
    float4 bg = pictureBlurRGBA(uImage, uImageSmplr, param_10, param_11, _214);
    float3 col = bg.xyz * (1.0 - _214.uDim);
    float2 param_12 = p - float2(0.01200000010430812835693359375, -0.0199999995529651641845703125);
    float param_13 = _214.uBevel * 2.0;
    float shadow = textAt(param_12, param_13, _214, uText, uTextSmplr);
    col *= (1.0 - ((_214.uShadow * 0.60000002384185791015625) * shadow));
    col += ((float3(_214.uBeamColor) * beam) * 0.100000001490116119384765625);
    float3 thrown = float3(0.0);
    float3 weight = float3(0.0);
    for (int i = 0; i < 4; i++)
    {
        float x = (float(i) + 0.5) / 4.0;
        float param_14 = x;
        float3 w = spectrum(param_14);
        float2 param_15 = p - (along * (0.02999999932944774627685546875 + (0.0500000007450580596923828125 * x)));
        float param_16 = _214.uBevel * 1.5;
        thrown += (w * textAt(param_15, param_16, _214, uText, uTextSmplr));
        weight += w;
    }
    col += ((((float3(_214.uBeamColor) * (thrown / weight)) * beam) * _214.uPrism) * 0.4000000059604644775390625);
    float2 param_17 = p;
    float param_18 = _214.uBevel * 4.0;
    float2 lens = bevelSlope(param_17, param_18, _214, uText, uTextSmplr);
    float2 bend = ((-(s + (lens * 0.800000011920928955078125))) * _214.uRefraction) * 0.0599999986588954925537109375;
    float2 param_19 = uv + (bend * toUv);
    float2 param_20 = ((bend * toUv) * _214.uDispersion) * 3.0;
    float param_21 = 1.0 + (_214.uFrost * 28.0);
    float4 seen = dispersed(uImage, uImageSmplr, param_19, param_20, param_21, _214);
    float3 glass = seen.xyz * (1.0 - (_214.uDim * 0.5));
    glass = mix(glass, (glass * float3(_214.uTint)) * 1.14999997615814208984375, float3(_214.uTintAlpha * (0.4000000059604644775390625 + (0.60000002384185791015625 * h))));
    glass = mix(glass, float3(dot(glass, float3(0.2989999949932098388671875, 0.58700001239776611328125, 0.114000000059604644775390625))) + float3(0.100000001490116119384765625), float3(_214.uFrost * 0.25));
    float3 n = fast::normalize(float3((-s) * 1.39999997615814208984375, 1.0));
    float3 light = float3(-0.447213590145111083984375, 0.536656320095062255859375, 0.715541779994964599609375);
    glass *= (1.0 - ((0.300000011920928955078125 * fast::clamp(dot(s, light.xy), -1.0, 1.0)) * rim));
    glass *= (1.0 - ((0.449999988079071044921875 * smoothstep(0.3499999940395355224609375, 0.89999997615814208984375, slope)) * (1.0 - smoothstep(0.89999997615814208984375, 1.39999997615814208984375, slope))));
    float spec = powr(fast::max(dot(reflect(-light, n), float3(0.0, 0.0, 1.0)), 0.0), 24.0);
    glass += float3(_214.uGloss * ((spec * 0.800000011920928955078125) + ((0.25 * rim) * fast::clamp(n.y + 0.300000011920928955078125, 0.0, 1.0))));
    glass += float3((_214.uGloss * 0.0599999986588954925537109375) * (1.0 - rim));
    glass += ((float3(_214.uBeamColor) * beam) * (0.119999997317790985107421875 + (0.449999988079071044921875 * rim)));
    float x_1 = fast::clamp((0.5 + (dot(s, across) * 0.89999997615814208984375)) + ((0.4000000059604644775390625 * d) / _214.uBeamWidth), 0.0, 1.0);
    float param_22 = x_1;
    glass += ((((spectrum(param_22) * beam) * smoothstep(0.0500000007450580596923828125, 0.60000002384185791015625, slope)) * _214.uPrism) * 1.10000002384185791015625);
    col = mix(col, glass, float3(mask));
    fragColor = float4(col, fast::max(bg.w, mask));
}

fragment flair_glass_text_frag_out flair_glass_text_frag(constant FlairUniforms& _214 [[buffer(0)]], texture2d<float> uText [[texture(1)]], texture2d<float> uImage [[texture(2)]], sampler uTextSmplr [[sampler(1)]], sampler uImageSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_glass_text_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1109;
    if (_214.flair_flipY > 0.5)
    {
        _1109 = _214.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1109 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1109);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _214, uText, uTextSmplr, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

