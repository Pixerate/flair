// flair-metal-hash: 769ccd56
#pragma clang diagnostic ignored "-Wmissing-prototypes"
#pragma clang diagnostic ignored "-Wmissing-braces"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

template<typename T, size_t Num>
struct spvUnsafeArray
{
    T elements[Num ? Num : 1];
    
    thread T& operator [] (size_t pos) thread
    {
        return elements[pos];
    }
    constexpr const thread T& operator [] (size_t pos) const thread
    {
        return elements[pos];
    }
    
    device T& operator [] (size_t pos) device
    {
        return elements[pos];
    }
    constexpr const device T& operator [] (size_t pos) const device
    {
        return elements[pos];
    }
    
    constexpr const constant T& operator [] (size_t pos) const constant
    {
        return elements[pos];
    }
    
    threadgroup T& operator [] (size_t pos) threadgroup
    {
        return elements[pos];
    }
    constexpr const threadgroup T& operator [] (size_t pos) const threadgroup
    {
        return elements[pos];
    }
};

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
    int uPanes;
    float uSize;
    float uStrength;
    float uShift;
    float uRefraction;
    float uRim;
    float uSpeed;
    uint uDemo;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_dichroic_glass_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2x2 rot(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
}

static inline __attribute__((always_inline))
float boxSdf(thread const float2& p, thread const float2& b, thread const float& r)
{
    float2 q = (abs(p) - b) + float2(r);
    return (length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0)) - r;
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
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _137)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_137.uBackdrop) * _137.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_137.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float4 pictureBlurRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, thread const float& blurPx, constant FlairUniforms& _137)
{
    float2 size = float2(int2(tex.get_width(), tex.get_height()));
    if (size.x <= 1.0)
    {
        float2 param = fract(uv);
        return float4(testCard(param), 1.0);
    }
    float4 param_1 = tex.sample(texSmplr, uv, level(log2(fast::max((blurPx * size.x) / _137.iResolution[0u], 1.0))));
    return overBackdrop(param_1, _137);
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
float4 dispersed(texture2d<float> tex, sampler texSmplr, thread const float2& uv, thread const float2& shift, thread const float& blurPx, constant FlairUniforms& _137)
{
    if (dot(shift, shift) < 9.9999999600419720025001879548654e-13)
    {
        float2 param = uv;
        float param_1 = blurPx;
        return pictureBlurRGBA(tex, texSmplr, param, param_1, _137);
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
        float4 c = pictureBlurRGBA(tex, texSmplr, param_3, param_4, _137);
        sum += (c.xyz * w);
        weight += w;
        alpha += c.w;
    }
    return float4(sum / weight, alpha / 5.0);
}

static inline __attribute__((always_inline))
float3 film(thread const float& phase)
{
    return float3(0.5) + (cos((float3(phase) + float3(0.0, 0.3300000131130218505859375, 0.670000016689300537109375)) * 6.28318023681640625) * 0.5);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _137, texture2d<float> uImage, sampler uImageSmplr)
{
    float px = 1.0 / _137.iResolution[1u];
    float2 p = (fragCoord - (float2(_137.iResolution[0], _137.iResolution[1]) * 0.5)) * px;
    float2 uv = fragCoord / float2(_137.iResolution[0], _137.iResolution[1]);
    float t = _137.iTime * _137.uSpeed;
    float hover = fast::clamp(_137.iPointer.z, 0.0, 1.0);
    float2 _457;
    if (_137.uDemo != 0u)
    {
        _457 = float2(sin(t * 1.2999999523162841796875), cos(t * 0.89999997615814208984375)) * 0.4000000059604644775390625;
    }
    else
    {
        _457 = float2(0.0);
    }
    float2 idle = _457;
    float2 tilt = mix(idle, ((_137.iPointer.xy - (float2(_137.iResolution[0], _137.iResolution[1]) * 0.5)) * px) * 2.0, float2(hover));
    float2 bend = float2(0.0);
    float rim = 0.0;
    float2 _512;
    float _577;
    spvUnsafeArray<float, 3> sds;
    spvUnsafeArray<float2, 3> locals;
    for (int i = 0; i < 3; i++)
    {
        float fi = float(i);
        if (_137.uPanes == 1)
        {
            _512 = float2(0.0);
        }
        else
        {
            _512 = float2(cos((fi * 2.0940001010894775390625) + 0.5), sin((fi * 2.0940001010894775390625) + 0.5)) * 0.1599999964237213134765625;
        }
        float2 centre = _512 + (float2(sin(t + (fi * 2.0)), cos((t * 0.800000011920928955078125) + fi)) * 0.039999999105930328369140625);
        float param = ((0.3499999940395355224609375 * fi) - 0.300000011920928955078125) + (0.100000001490116119384765625 * sin((t * 0.5) + fi));
        float2 local = rot(param) * (p - centre);
        float2 hs = float2((0.5 * _137.uSize) * (1.0 - (0.1500000059604644775390625 * fi)), 0.4000000059604644775390625 * _137.uSize);
        if (i < _137.uPanes)
        {
            float2 param_1 = local;
            float2 param_2 = hs;
            float param_3 = 0.0599999986588954925537109375 * _137.uSize;
            _577 = boxSdf(param_1, param_2, param_3);
        }
        else
        {
            _577 = 1.0;
        }
        float sd = _577;
        sds[i] = sd;
        locals[i] = local / hs;
        float near = exp((-fast::max(-sd, 0.0)) / (0.02500000037252902984619140625 * _137.uSize)) * step(sd, 0.0);
        bend += (((fast::normalize(local + float2(9.9999997473787516355514526367188e-05)) * near) * _137.uRefraction) * 0.01200000010430812835693359375);
        rim = fast::max(rim, exp((-abs(sd)) / (1.2000000476837158203125 * px)));
    }
    float2 param_4 = uv - (bend * float2(_137.iResolution[1u] / _137.iResolution[0u], 1.0));
    float2 param_5 = (bend * float2(_137.iResolution[1u] / _137.iResolution[0u], 1.0)) * 2.0;
    float param_6 = 1.0;
    float4 pic = dispersed(uImage, uImageSmplr, param_4, param_5, param_6, _137);
    float3 col = pic.xyz;
    float cover = 0.0;
    for (int i_1 = 0; i_1 < 3; i_1++)
    {
        float inside = fast::clamp(0.5 - (sds[i_1] / px), 0.0, 1.0);
        if (inside <= 0.0)
        {
            continue;
        }
        float fi_1 = float(i_1);
        float2 l = locals[i_1];
        float phase = (((fi_1 * 0.310000002384185791015625) + (_137.uShift * ((0.3499999940395355224609375 * l.x) - (0.20000000298023223876953125 * l.y)))) + dot(tilt, float2(0.5, 0.300000011920928955078125))) + (0.02999999932944774627685546875 * t);
        float param_7 = phase;
        float3 pass = film(param_7);
        float3 through = (col * mix(float3(1.0), pass * 1.60000002384185791015625, float3(_137.uStrength))) + ((pass * 0.100000001490116119384765625) * _137.uStrength);
        float edge = exp(sds[i_1] / (0.039999999105930328369140625 * _137.uSize));
        float band = exp(-powr(((l.x + (l.y * 0.4000000059604644775390625)) - (tilt.x * 0.60000002384185791015625)) * 2.5, 2.0));
        through += (((float3(1.0) - pass) * _137.uStrength) * ((0.449999988079071044921875 * edge) + (0.20000000298023223876953125 * band)));
        col = mix(col, through, float3(inside));
        cover = fast::max(cover, inside);
    }
    col += float3((rim * _137.uRim) * 0.699999988079071044921875);
    fragColor = float4(col, fast::max(pic.w, cover));
}

fragment flair_dichroic_glass_frag_out flair_dichroic_glass_frag(constant FlairUniforms& _137 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_dichroic_glass_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _827;
    if (_137.flair_flipY > 0.5)
    {
        _827 = _137.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _827 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _827);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _137, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

