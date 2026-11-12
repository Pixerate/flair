// flair-metal-hash: 0c0e4490
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
    float uAzimuth;
    float uElevation;
    char _m15_pad[8];
    packed_float3 uLight;
    float uIntensity;
    packed_float3 uAmbientColor;
    float uAmbient;
    float uStrength;
    float uSpecular;
    float uFalloff;
    char _m22_pad[4];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_relight_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

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
float heightAt(thread const float2& uv, thread const float& lod, texture2d<float> uImage, sampler uImageSmplr)
{
    float3 _248;
    if (int2(uImage.get_width(), uImage.get_height()).x > 1)
    {
        _248 = uImage.sample(uImageSmplr, uv, level(lod)).xyz;
    }
    else
    {
        float2 param = fract(uv);
        _248 = testCard(param);
    }
    float3 c = _248;
    return dot(c, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
}

static inline __attribute__((always_inline))
float2 heightSlope(thread const float2& uv, constant FlairUniforms& _77, texture2d<float> uImage, sampler uImageSmplr)
{
    int2 size = int2(uImage.get_width(), uImage.get_height());
    float2 _280;
    if (size.x > 1)
    {
        _280 = float2(1.0) / float2(size);
    }
    else
    {
        _280 = float2(1.0) / float2(_77.iResolution[0], _77.iResolution[1]);
    }
    float2 texel = _280;
    float _298;
    if (size.x > 1)
    {
        _298 = float(size.y);
    }
    else
    {
        _298 = _77.iResolution[1u];
    }
    float texH = _298;
    float2 d = texel * 1.5;
    float2 param = uv + float2(-d.x, d.y);
    float param_1 = 0.0;
    float tl = heightAt(param, param_1, uImage, uImageSmplr);
    float2 param_2 = uv + float2(0.0, d.y);
    float param_3 = 0.0;
    float tc = heightAt(param_2, param_3, uImage, uImageSmplr);
    float2 param_4 = uv + d;
    float param_5 = 0.0;
    float tr = heightAt(param_4, param_5, uImage, uImageSmplr);
    float2 param_6 = uv - float2(d.x, 0.0);
    float param_7 = 0.0;
    float ml = heightAt(param_6, param_7, uImage, uImageSmplr);
    float2 param_8 = uv + float2(d.x, 0.0);
    float param_9 = 0.0;
    float mr = heightAt(param_8, param_9, uImage, uImageSmplr);
    float2 param_10 = uv - d;
    float param_11 = 0.0;
    float bl = heightAt(param_10, param_11, uImage, uImageSmplr);
    float2 param_12 = uv - float2(0.0, d.y);
    float param_13 = 0.0;
    float bc = heightAt(param_12, param_13, uImage, uImageSmplr);
    float2 param_14 = uv + float2(d.x, -d.y);
    float param_15 = 0.0;
    float br = heightAt(param_14, param_15, uImage, uImageSmplr);
    float2 fine = float2(((((tr + (2.0 * mr)) + br) - tl) - (2.0 * ml)) - bl, ((((tl + (2.0 * tc)) + tr) - bl) - (2.0 * bc)) - br) * 0.125;
    float s1 = 0.0199999995529651641845703125 * texH;
    float2 d1 = texel * s1;
    float l1 = log2(fast::max(s1, 1.0));
    float2 param_16 = uv + float2(d1.x, 0.0);
    float param_17 = l1;
    float2 param_18 = uv - float2(d1.x, 0.0);
    float param_19 = l1;
    float2 param_20 = uv + float2(0.0, d1.y);
    float param_21 = l1;
    float2 param_22 = uv - float2(0.0, d1.y);
    float param_23 = l1;
    float2 mid = float2(heightAt(param_16, param_17, uImage, uImageSmplr) - heightAt(param_18, param_19, uImage, uImageSmplr), heightAt(param_20, param_21, uImage, uImageSmplr) - heightAt(param_22, param_23, uImage, uImageSmplr)) * 0.5;
    float s2 = 0.07999999821186065673828125 * texH;
    float2 d2 = texel * s2;
    float l2 = log2(fast::max(s2, 1.0));
    float2 param_24 = uv + float2(d2.x, 0.0);
    float param_25 = l2;
    float2 param_26 = uv - float2(d2.x, 0.0);
    float param_27 = l2;
    float2 param_28 = uv + float2(0.0, d2.y);
    float param_29 = l2;
    float2 param_30 = uv - float2(0.0, d2.y);
    float param_31 = l2;
    float2 broad = float2(heightAt(param_24, param_25, uImage, uImageSmplr) - heightAt(param_26, param_27, uImage, uImageSmplr), heightAt(param_28, param_29, uImage, uImageSmplr) - heightAt(param_30, param_31, uImage, uImageSmplr)) * 0.5;
    return ((fine * 0.5) + (mid * 0.60000002384185791015625)) + (broad * 0.60000002384185791015625);
}

static inline __attribute__((always_inline))
float3 surfaceNormal(thread const float2& uv, thread const float& strength, constant FlairUniforms& _77, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param = uv;
    return fast::normalize(float3((-heightSlope(param, _77, uImage, uImageSmplr)) * strength, 1.0));
}

static inline __attribute__((always_inline))
float2 shade(thread const float3& n, thread const float3& l, thread const float& shininess)
{
    float diff = fast::max(dot(n, l), 0.0);
    float3 h = fast::normalize(l + float3(0.0, 0.0, 1.0));
    float spec = powr(fast::max(dot(n, h), 0.0), shininess) * step(0.0, diff - 0.001000000047497451305389404296875);
    return float2(diff, spec);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _77)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_77.uBackdrop) * _77.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_77.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _77)
{
    float4 _221;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _221 = overBackdrop(param, _77);
    }
    else
    {
        float2 param_1 = fract(uv);
        _221 = float4(testCard(param_1), 1.0);
    }
    return _221;
}

static inline __attribute__((always_inline))
float3 rolloff(thread const float3& c)
{
    return c / (float3(1.0) + fast::max(c - float3(1.0), float3(0.0)));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _77, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_77.iResolution[0], _77.iResolution[1]);
    float2 p = (fragCoord - (float2(_77.iResolution[0], _77.iResolution[1]) * 0.5)) / float2(_77.iResolution[1u]);
    float az = radians(_77.uAzimuth);
    float el = radians(_77.uElevation);
    float3 l = float3(cos(el) * cos(az), cos(el) * sin(az), sin(el));
    float2 param = uv;
    float param_1 = _77.uStrength;
    float3 n = surfaceNormal(param, param_1, _77, uImage, uImageSmplr);
    float3 param_2 = n;
    float3 param_3 = l;
    float param_4 = 36.0;
    float2 s = shade(param_2, param_3, param_4);
    float wash = fast::max(1.0 + (((_77.uFalloff * dot(p, l.xy)) * 1.60000002384185791015625) * (1.0 - (0.60000002384185791015625 * l.z))), 0.0);
    float2 param_5 = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_5, _77);
    float3 lit = (float3(_77.uAmbientColor) * _77.uAmbient) + (((float3(_77.uLight) * _77.uIntensity) * s.x) * wash);
    float3 col = (pic.xyz * lit) + (((float3(_77.uLight) * s.y) * _77.uSpecular) * wash);
    float3 param_6 = col;
    fragColor = float4(rolloff(param_6), pic.w);
}

fragment flair_relight_frag_out flair_relight_frag(constant FlairUniforms& _77 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_relight_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _722;
    if (_77.flair_flipY > 0.5)
    {
        _722 = _77.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _722 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _722);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _77, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

