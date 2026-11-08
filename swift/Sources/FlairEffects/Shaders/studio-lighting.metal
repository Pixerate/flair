// flair-metal-hash: 4f7b0449
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
    float uKeyAngle;
    char _m14_pad[12];
    packed_float3 uKeyColor;
    float uKey;
    packed_float3 uFillColor;
    float uFill;
    packed_float3 uRimColor;
    float uRim;
    float uRimWidth;
    float uStrength;
    float uKeyOut;
    char _m23_pad[4];
    packed_float3 uStudio;
    float uStudioMix;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_studio_lighting_frag_out
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
    float3 _252;
    if (int2(uImage.get_width(), uImage.get_height()).x > 1)
    {
        _252 = uImage.sample(uImageSmplr, uv, level(lod)).xyz;
    }
    else
    {
        float2 param = fract(uv);
        _252 = testCard(param);
    }
    float3 c = _252;
    return dot(c, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
}

static inline __attribute__((always_inline))
float2 heightSlope(thread const float2& uv, constant FlairUniforms& _81, texture2d<float> uImage, sampler uImageSmplr)
{
    int2 size = int2(uImage.get_width(), uImage.get_height());
    float2 _284;
    if (size.x > 1)
    {
        _284 = float2(1.0) / float2(size);
    }
    else
    {
        _284 = float2(1.0) / float2(_81.iResolution[0], _81.iResolution[1]);
    }
    float2 texel = _284;
    float _302;
    if (size.x > 1)
    {
        _302 = float(size.y);
    }
    else
    {
        _302 = _81.iResolution[1u];
    }
    float texH = _302;
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
float3 surfaceNormal(thread const float2& uv, thread const float& strength, constant FlairUniforms& _81, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param = uv;
    return fast::normalize(float3((-heightSlope(param, _81, uImage, uImageSmplr)) * strength, 1.0));
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
float subjectAt(thread const float2& uv, thread const float& lod, constant FlairUniforms& _81, texture2d<float> uImage, sampler uImageSmplr, thread bool& gKeyOn, thread float3& gKey)
{
    if (int2(uImage.get_width(), uImage.get_height()).x <= 1)
    {
        return 1.0;
    }
    bool _598 = uv.x < 0.0;
    bool _605;
    if (!_598)
    {
        _605 = uv.x > 1.0;
    }
    else
    {
        _605 = _598;
    }
    bool _612;
    if (!_605)
    {
        _612 = uv.y < 0.0;
    }
    else
    {
        _612 = _605;
    }
    bool _619;
    if (!_612)
    {
        _619 = uv.y > 1.0;
    }
    else
    {
        _619 = _612;
    }
    if (_619)
    {
        return 0.0;
    }
    float4 c = uImage.sample(uImageSmplr, uv, level(lod));
    float a = c.w;
    if (gKeyOn)
    {
        a *= smoothstep(_81.uKeyOut, _81.uKeyOut + 0.119999997317790985107421875, distance(c.xyz / float3(fast::max(c.w, 0.001000000047497451305389404296875)), gKey));
    }
    return a;
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _81)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_81.uBackdrop) * _81.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_81.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _81)
{
    float4 _225;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _225 = overBackdrop(param, _81);
    }
    else
    {
        float2 param_1 = fract(uv);
        _225 = float4(testCard(param_1), 1.0);
    }
    return _225;
}

static inline __attribute__((always_inline))
float3 rolloff(thread const float3& c)
{
    return c / (float3(1.0) + fast::max(c - float3(1.0), float3(0.0)));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _81, texture2d<float> uImage, sampler uImageSmplr, thread bool& gKeyOn, thread float3& gKey)
{
    float2 uv = fragCoord / float2(_81.iResolution[0], _81.iResolution[1]);
    float2 p = (fragCoord - (float2(_81.iResolution[0], _81.iResolution[1]) * 0.5)) / float2(_81.iResolution[1u]);
    float4 corner = uImage.sample(uImageSmplr, float2(0.00999999977648258209228515625, 0.9900000095367431640625), level(0.0));
    gKey = corner.xyz / float3(fast::max(corner.w, 0.001000000047497451305389404296875));
    bool _691 = _81.uKeyOut > 0.0;
    bool _697;
    if (_691)
    {
        _697 = corner.w > 0.5;
    }
    else
    {
        _697 = _691;
    }
    gKeyOn = _697;
    int2 size = int2(uImage.get_width(), uImage.get_height());
    float _706;
    if (size.x > 1)
    {
        _706 = float(size.y);
    }
    else
    {
        _706 = _81.iResolution[1u];
    }
    float texH = _706;
    float _720;
    if (size.x > 1)
    {
        _720 = float(size.y) / float(size.x);
    }
    else
    {
        _720 = _81.iResolution[1u] / _81.iResolution[0u];
    }
    float2 aspect = float2(_720, 1.0);
    float ka = radians(_81.uKeyAngle);
    float2 keyDir = float2(cos(ka), sin(ka));
    float3 key = fast::normalize(float3(keyDir * 0.800000011920928955078125, 0.60000002384185791015625));
    float3 fill = fast::normalize(float3((-keyDir) * 0.89999997615814208984375, 0.449999988079071044921875));
    float2 rimDir = fast::normalize(float2(-keyDir.x, 0.5 + (0.5 * abs(keyDir.y))));
    float2 param = uv;
    float param_1 = _81.uStrength;
    float3 n = surfaceNormal(param, param_1, _81, uImage, uImageSmplr);
    float3 param_2 = n;
    float3 param_3 = key;
    float param_4 = 30.0;
    float2 ks = shade(param_2, param_3, param_4);
    float fillWrap = fast::clamp((dot(n, fill) + 0.4000000059604644775390625) / 1.39999997615814208984375, 0.0, 1.0);
    float2 param_5 = uv;
    float param_6 = 0.0;
    float subject = subjectAt(param_5, param_6, _81, uImage, uImageSmplr, gKeyOn, gKey);
    float lod = log2(fast::max((_81.uRimWidth * texH) * 0.60000002384185791015625, 1.0));
    float2 w = (rimDir * _81.uRimWidth) * aspect;
    float2 param_7 = uv + w;
    float param_8 = lod;
    float2 param_9 = uv + (w * 0.5);
    float param_10 = lod - 1.0;
    float toward = 0.5 * (subjectAt(param_7, param_8, _81, uImage, uImageSmplr, gKeyOn, gKey) + subjectAt(param_9, param_10, _81, uImage, uImageSmplr, gKeyOn, gKey));
    float2 param_11 = uv + (float2(_81.uRimWidth, 0.0) * aspect);
    float param_12 = lod;
    float2 param_13 = uv - (float2(_81.uRimWidth, 0.0) * aspect);
    float param_14 = lod;
    float2 param_15 = uv + float2(0.0, _81.uRimWidth);
    float param_16 = lod;
    float2 param_17 = uv - float2(0.0, _81.uRimWidth);
    float param_18 = lod;
    float around = 0.25 * (((subjectAt(param_11, param_12, _81, uImage, uImageSmplr, gKeyOn, gKey) + subjectAt(param_13, param_14, _81, uImage, uImageSmplr, gKeyOn, gKey)) + subjectAt(param_15, param_16, _81, uImage, uImageSmplr, gKeyOn, gKey)) + subjectAt(param_17, param_18, _81, uImage, uImageSmplr, gKeyOn, gKey));
    float rim = subject * (fast::clamp(1.0 - toward, 0.0, 1.0) + (0.300000011920928955078125 * fast::clamp(1.0 - around, 0.0, 1.0)));
    rim = smoothstep(0.0500000007450580596923828125, 0.60000002384185791015625, rim);
    float2 param_19 = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_19, _81);
    float3 lit = (float3(0.0599999986588954925537109375) + ((float3(_81.uKeyColor) * _81.uKey) * ks.x)) + ((float3(_81.uFillColor) * _81.uFill) * fillWrap);
    float3 col = ((pic.xyz * lit) + (((float3(_81.uKeyColor) * ks.y) * _81.uKey) * 0.25)) + (((float3(_81.uRimColor) * rim) * _81.uRim) * (float3(0.60000002384185791015625) + (pic.xyz * 0.4000000059604644775390625)));
    float pool = exp((-2.5) * dot(p - (keyDir * 0.3499999940395355224609375), p - (keyDir * 0.3499999940395355224609375)));
    float3 studio = (float3(_81.uStudio) * (0.550000011920928955078125 + (0.89999997615814208984375 * pool))) + (((float3(_81.uKeyColor) * float3(_81.uStudio)) * pool) * 0.60000002384185791015625);
    float back = (1.0 - subject) * _81.uStudioMix;
    col = mix(col, studio, float3(back));
    float3 param_20 = col;
    fragColor = float4(rolloff(param_20), pic.w);
}

fragment flair_studio_lighting_frag_out flair_studio_lighting_frag(constant FlairUniforms& _81 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_studio_lighting_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    bool gKeyOn;
    float3 gKey;
    float _1027;
    if (_81.flair_flipY > 0.5)
    {
        _1027 = _81.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1027 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1027);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _81, uImage, uImageSmplr, gKeyOn, gKey);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

