// flair-metal-hash: 2b16144c
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
    float2 uSource;
    float uTubeAngle;
    float uLength;
    float3 uColorA;
    packed_float3 uColorB;
    float uIntensity;
    float uFlicker;
    float uAmbient;
    float uStrength;
    uint uShowTube;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_neon_spill_frag_out
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
    float3 _274;
    if (int2(uImage.get_width(), uImage.get_height()).x > 1)
    {
        _274 = uImage.sample(uImageSmplr, uv, level(lod)).xyz;
    }
    else
    {
        float2 param = fract(uv);
        _274 = testCard(param);
    }
    float3 c = _274;
    return dot(c, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
}

static inline __attribute__((always_inline))
float2 heightSlope(thread const float2& uv, constant FlairUniforms& _75, texture2d<float> uImage, sampler uImageSmplr)
{
    int2 size = int2(uImage.get_width(), uImage.get_height());
    float2 _306;
    if (size.x > 1)
    {
        _306 = float2(1.0) / float2(size);
    }
    else
    {
        _306 = float2(1.0) / float2(_75.iResolution[0], _75.iResolution[1]);
    }
    float2 texel = _306;
    float _324;
    if (size.x > 1)
    {
        _324 = float(size.y);
    }
    else
    {
        _324 = _75.iResolution[1u];
    }
    float texH = _324;
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
float3 surfaceNormal(thread const float2& uv, thread const float& strength, constant FlairUniforms& _75, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param = uv;
    return fast::normalize(float3((-heightSlope(param, _75, uImage, uImageSmplr)) * strength, 1.0));
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _75)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_75.uBackdrop) * _75.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_75.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _75)
{
    float4 _219;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _219 = overBackdrop(param, _75);
    }
    else
    {
        float2 param_1 = fract(uv);
        _219 = float4(testCard(param_1), 1.0);
    }
    return _219;
}

static inline __attribute__((always_inline))
float3 rolloff(thread const float3& c)
{
    return c / (float3(1.0) + fast::max(c - float3(1.0), float3(0.0)));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _75, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_75.iResolution[0], _75.iResolution[1]);
    float2 p = (fragCoord - (float2(_75.iResolution[0], _75.iResolution[1]) * 0.5)) / float2(_75.iResolution[1u]);
    float aspect = _75.iResolution[0u] / _75.iResolution[1u];
    float2 c = (_75.uSource * float2(aspect, 1.0)) * 0.5;
    float ta = radians(_75.uTubeAngle);
    float2 dir = (float2(cos(ta), sin(ta)) * _75.uLength) * 0.5;
    float t = _75.iTime;
    float2 param = float2(floor(t * 40.0), 1.0);
    float buzz = 0.07999999821186065673828125 * hash12(param);
    float2 param_1 = float2(floor(t * 5.0), 2.0);
    float2 param_2 = float2(floor(t * 30.0), 3.0);
    float stutter = step(0.87999999523162841796875, hash12(param_1)) * step(0.5, hash12(param_2));
    float on = 1.0 - (_75.uFlicker * (buzz + (0.75 * stutter)));
    float2 param_3 = uv;
    float param_4 = _75.uStrength;
    float3 n = surfaceNormal(param_3, param_4, _75, uImage, uImageSmplr);
    float3 light = float3(0.0);
    for (int i = 0; i < 5; i++)
    {
        float k = float(i) * 0.25;
        float2 at = c + (dir * ((k * 2.0) - 1.0));
        float3 toLight = float3(at - p, 0.20000000298023223876953125);
        float d2 = dot(toLight, toLight);
        float diff = fast::max(dot(n, toLight * rsqrt(d2)), 0.0);
        light += (((mix(_75.uColorA, float3(_75.uColorB), float3(smoothstep(0.300000011920928955078125, 0.699999988079071044921875, k))) * diff) * 0.02199999988079071044921875) / float3(d2 + 0.039999999105930328369140625));
    }
    light *= (_75.uIntensity * on);
    float2 param_5 = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_5, _75);
    float3 col = pic.xyz * ((float3(_75.uAmbient) * float3(0.550000011920928955078125, 0.60000002384185791015625, 0.800000011920928955078125)) + light);
    if (_75.uShowTube != 0u)
    {
        float2 a = c - dir;
        float2 ab = dir * 2.0;
        float h = fast::clamp(dot(p - a, ab) / fast::max(dot(ab, ab), 9.9999999747524270787835121154785e-07), 0.0, 1.0);
        float d = length((p - a) - (ab * h));
        float3 tint = mix(_75.uColorA, float3(_75.uColorB), float3(smoothstep(0.449999988079071044921875, 0.550000011920928955078125, h)));
        float core = smoothstep(0.0089999996125698089599609375, 0.0040000001899898052215576171875, d);
        float halo = (exp((-d) * 40.0) * 0.800000011920928955078125) + (exp((-d) * 12.0) * 0.300000011920928955078125);
        col = mix(col, mix(tint, float3(1.0), float3(0.699999988079071044921875)), float3(core * on)) + ((((tint * halo) * on) * _75.uIntensity) * 0.5);
    }
    float3 param_6 = col;
    fragColor = float4(rolloff(param_6), pic.w);
}

fragment flair_neon_spill_frag_out flair_neon_spill_frag(constant FlairUniforms& _75 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_neon_spill_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _877;
    if (_75.flair_flipY > 0.5)
    {
        _877 = _75.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _877 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _877);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _75, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

