// flair-metal-hash: 28ab8eb8
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
    float uRadius;
    float uZoom;
    uint uInvert;
    float uRefraction;
    float uDispersion;
    char _m18_pad[12];
    packed_float3 uTint;
    float uTintAlpha;
    float uRim;
    float uShadow;
    float uCaustic;
    uint uDemo;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_glass_orb_frag_out
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
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _107)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_107.uBackdrop) * _107.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_107.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float4 pictureBlurRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, thread const float& blurPx, constant FlairUniforms& _107)
{
    float2 size = float2(int2(tex.get_width(), tex.get_height()));
    if (size.x <= 1.0)
    {
        float2 param = fract(uv);
        return float4(testCard(param), 1.0);
    }
    float4 param_1 = tex.sample(texSmplr, uv, level(log2(fast::max((blurPx * size.x) / _107.iResolution[0u], 1.0))));
    return overBackdrop(param_1, _107);
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
float4 dispersed(texture2d<float> tex, sampler texSmplr, thread const float2& uv, thread const float2& shift, thread const float& blurPx, constant FlairUniforms& _107)
{
    if (dot(shift, shift) < 9.9999999600419720025001879548654e-13)
    {
        float2 param = uv;
        float param_1 = blurPx;
        return pictureBlurRGBA(tex, texSmplr, param, param_1, _107);
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
        float4 c = pictureBlurRGBA(tex, texSmplr, param_3, param_4, _107);
        sum += (c.xyz * w);
        weight += w;
        alpha += c.w;
    }
    return float4(sum / weight, alpha / 5.0);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _107, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_107.iResolution[0], _107.iResolution[1]);
    float2 param = uv;
    float param_1 = 1.0;
    float4 pic = pictureBlurRGBA(uImage, uImageSmplr, param, param_1, _107);
    float2 drift = float2(_107.iResolution[0], _107.iResolution[1]) * (float2(0.5) + float2(0.20000000298023223876953125 * sin(_107.iTime * 0.430000007152557373046875), 0.14000000059604644775390625 * sin((_107.iTime * 0.61000001430511474609375) + 1.2999999523162841796875)));
    float2 _393;
    if (_107.uDemo != 0u)
    {
        _393 = drift;
    }
    else
    {
        _393 = float2(_107.iResolution[0], _107.iResolution[1]) * 0.5;
    }
    float2 c = mix(_393, _107.iPointer.xy, float2(fast::clamp(_107.iPointer.z, 0.0, 1.0)));
    float R = _107.uRadius * _107.iResolution[1u];
    float2 q = (fragCoord - c) / float2(R);
    float r = length(q);
    float2 toLight = float2(-0.566528797149658203125, 0.824041903018951416015625);
    float3 col = pic.xyz;
    float2 sq = (q + (toLight * 0.449999988079071044921875)) * float2(1.0, 1.2999999523162841796875);
    col *= (1.0 - ((_107.uShadow * 0.60000002384185791015625) * smoothstep(1.0499999523162841796875, 0.5, length(sq))));
    float f = length(q + (toLight * 1.14999997615814208984375));
    float param_2 = fast::clamp((f - 0.119999997317790985107421875) / 0.20000000298023223876953125, 0.0, 1.0);
    col += ((float3(0.89999997615814208984375 * exp(((-f) * f) / 0.0199999995529651641845703125)) + (((spectrum(param_2) * 0.25) * smoothstep(0.3400000035762786865234375, 0.20000000298023223876953125, f)) * smoothstep(0.07999999821186065673828125, 0.14000000059604644775390625, f))) * _107.uCaustic);
    float inside = fast::clamp(((1.0 - r) * R) + 0.5, 0.0, 1.0);
    if (inside > 0.0)
    {
        float z = sqrt(fast::max(1.0 - (r * r), 0.0));
        float bend = 1.0 - z;
        float2 _524;
        if (_107.uInvert != 0u)
        {
            _524 = -q;
        }
        else
        {
            _524 = q;
        }
        float2 look = (_524 / float2(_107.uZoom)) * (1.0 + ((_107.uRefraction * bend) * 1.5));
        float2 toUv = float2(R) / float2(_107.iResolution[0], _107.iResolution[1]);
        float2 param_3 = (c / float2(_107.iResolution[0], _107.iResolution[1])) + (look * toUv);
        float2 param_4 = (((q * bend) * _107.uDispersion) * 0.25) * toUv;
        float param_5 = 1.0 + ((6.0 * bend) * bend);
        float4 seen = dispersed(uImage, uImageSmplr, param_3, param_4, param_5, _107);
        float3 glass = mix(seen.xyz, float3(_107.uTint), float3(_107.uTintAlpha));
        glass *= (1.0 - (((0.3499999940395355224609375 * bend) * bend) * bend));
        float3 n = float3(q, z);
        float fresnel = powr(bend, 4.0);
        float3 sky = mix(float3(0.20000000298023223876953125, 0.2199999988079071044921875, 0.2599999904632568359375), float3(1.0), float3(smoothstep(-0.300000011920928955078125, 0.800000011920928955078125, n.y)));
        glass = mix(glass, sky, float3((fresnel * _107.uRim) * 0.699999988079071044921875));
        float3 h = fast::normalize(fast::normalize(float3(toLight, 0.89999997615814208984375)) + float3(0.0, 0.0, 1.0));
        glass += float3((_107.uRim * 1.2000000476837158203125) * powr(fast::max(dot(n, h), 0.0), 90.0));
        float2 w = (q - float2(-0.300000011920928955078125, 0.519999980926513671875)) * float2(1.0, 2.2000000476837158203125);
        glass += float3((_107.uRim * 0.180000007152557373046875) * smoothstep(0.300000011920928955078125, 0.119999997317790985107421875, length(w)));
        glass += float3(((_107.uRim * 0.449999988079071044921875) * smoothstep(0.89999997615814208984375, 1.0, r)) * (0.5 + (0.5 * dot(q / float2(fast::max(r, 0.001000000047497451305389404296875)), toLight))));
        col = mix(col, glass, float3(inside));
    }
    fragColor = float4(col, fast::max(pic.w, inside));
}

fragment flair_glass_orb_frag_out flair_glass_orb_frag(constant FlairUniforms& _107 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_glass_orb_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _721;
    if (_107.flair_flipY > 0.5)
    {
        _721 = _107.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _721 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _721);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _107, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

