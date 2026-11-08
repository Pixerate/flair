// flair-metal-hash: d5987574
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
    float2 uSource;
    char _m14_pad[8];
    packed_float3 uColor;
    float uIntensity;
    float uFlicker;
    float uReach;
    float uAmbient;
    float uBloom;
    float uStrength;
    uint uShowFlame;
    char _m22_pad[8];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_candlelight_frag_out
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
    float3 _338;
    if (int2(uImage.get_width(), uImage.get_height()).x > 1)
    {
        _338 = uImage.sample(uImageSmplr, uv, level(lod)).xyz;
    }
    else
    {
        float2 param = fract(uv);
        _338 = testCard(param);
    }
    float3 c = _338;
    return dot(c, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
}

static inline __attribute__((always_inline))
float2 heightSlope(thread const float2& uv, constant FlairUniforms& _84, texture2d<float> uImage, sampler uImageSmplr)
{
    int2 size = int2(uImage.get_width(), uImage.get_height());
    float2 _370;
    if (size.x > 1)
    {
        _370 = float2(1.0) / float2(size);
    }
    else
    {
        _370 = float2(1.0) / float2(_84.iResolution[0], _84.iResolution[1]);
    }
    float2 texel = _370;
    float _388;
    if (size.x > 1)
    {
        _388 = float(size.y);
    }
    else
    {
        _388 = _84.iResolution[1u];
    }
    float texH = _388;
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
float3 surfaceNormal(thread const float2& uv, thread const float& strength, constant FlairUniforms& _84, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param = uv;
    return fast::normalize(float3((-heightSlope(param, _84, uImage, uImageSmplr)) * strength, 1.0));
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
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _84)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_84.uBackdrop) * _84.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_84.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _84)
{
    float4 _228;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _228 = overBackdrop(param, _84);
    }
    else
    {
        float2 param_1 = fract(uv);
        _228 = float4(testCard(param_1), 1.0);
    }
    return _228;
}

static inline __attribute__((always_inline))
float3 rolloff(thread const float3& c)
{
    return c / (float3(1.0) + fast::max(c - float3(1.0), float3(0.0)));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _84, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_84.iResolution[0], _84.iResolution[1]);
    float2 p = (fragCoord - (float2(_84.iResolution[0], _84.iResolution[1]) * 0.5)) / float2(_84.iResolution[1u]);
    float aspect = _84.iResolution[0u] / _84.iResolution[1u];
    float t = _84.iTime;
    float2 param = float2(t * 7.0, 0.5);
    float2 param_1 = float2(t * 17.0, 4.0);
    float f = (vnoise(param) * 0.60000002384185791015625) + (vnoise(param_1) * 0.4000000059604644775390625);
    float power = 1.0 - ((_84.uFlicker * 0.449999988079071044921875) * (1.0 - f));
    float2 param_2 = float2(t * 3.0, 9.0);
    float2 param_3 = float2(t * 5.0, 13.0);
    float2 lean = (float2(vnoise(param_2) - 0.5, vnoise(param_3) - 0.5) * float2(0.02999999932944774627685546875, 0.014999999664723873138427734375)) * _84.uFlicker;
    float2 base = (_84.uSource * float2(aspect, 1.0)) * 0.5;
    float2 flamePos = (base + float2(0.0, 0.0350000001490116119384765625)) + lean;
    float3 toLight = float3(flamePos - p, 0.119999997317790985107421875);
    float dist = length(toLight);
    float k = dist / (0.300000011920928955078125 * _84.uReach);
    float att = (1.0 / (1.0 + (k * k))) * (1.0 - smoothstep(0.5 * _84.uReach, 1.60000002384185791015625 * _84.uReach, dist));
    float2 param_4 = uv;
    float param_5 = _84.uStrength;
    float3 n = surfaceNormal(param_4, param_5, _84, uImage, uImageSmplr);
    float3 param_6 = n;
    float3 param_7 = toLight / float3(dist);
    float param_8 = 20.0;
    float2 s = shade(param_6, param_7, param_8);
    float2 param_9 = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_9, _84);
    float3 warm = ((float3(_84.uColor) * _84.uIntensity) * att) * power;
    float3 col = (pic.xyz * ((float3(_84.uAmbient) * float3(0.60000002384185791015625, 0.60000002384185791015625, 0.89999997615814208984375)) + (warm * s.x))) + ((warm * s.y) * 0.20000000298023223876953125);
    float3 _863;
    if (int2(uImage.get_width(), uImage.get_height()).x > 1)
    {
        _863 = uImage.sample(uImageSmplr, uv, level(4.0)).xyz;
    }
    else
    {
        _863 = pic.xyz;
    }
    float3 soft = _863;
    col += (((soft * warm) * 0.25) * _84.uBloom);
    float fd = length(p - flamePos);
    col += (((float3(_84.uColor) * power) * _84.uBloom) * ((exp((-fd) * 9.0) * 0.5) + (exp((-fd) * 30.0) * 0.60000002384185791015625)));
    if (_84.uShowFlame != 0u)
    {
        float2 q = (p - flamePos) / float2(0.01200000010430812835693359375, 0.02999999932944774627685546875);
        q.x += ((lean.x * 8.0) * fast::max(q.y, 0.0));
        float shape = length(float2(q.x * (1.0 + (fast::max(q.y, 0.0) * 0.89999997615814208984375)), q.y));
        float flame = smoothstep(1.0, 0.550000011920928955078125, shape);
        float core = smoothstep(0.60000002384185791015625, 0.100000001490116119384765625, length(float2(q.x * 1.39999997615814208984375, q.y + 0.449999988079071044921875)));
        col = mix(col, mix(float3(_84.uColor) * 1.39999997615814208984375, float3(1.0, 0.949999988079071044921875, 0.800000011920928955078125), float3(core)), float3(flame * power));
    }
    float3 param_10 = col;
    fragColor = float4(rolloff(param_10), pic.w);
}

fragment flair_candlelight_frag_out flair_candlelight_frag(constant FlairUniforms& _84 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_candlelight_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1002;
    if (_84.flair_flipY > 0.5)
    {
        _1002 = _84.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1002 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1002);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _84, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

