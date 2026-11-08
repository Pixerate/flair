// flair-metal-hash: c9a1a9e4
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
    packed_float3 uColour;
    float uSheen;
    float uGlitter;
    float uGrain;
    float uDensity;
    float uSkinOnly;
    float2 uCentre;
    float uSpacing;
    float2 uSize;
    float uFeather;
    char _m23_pad[4];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_beauty_highlighter_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _102)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_102.uBackdrop) * _102.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_102.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _102)
{
    float4 _244;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _244 = overBackdrop(param, _102);
    }
    else
    {
        float2 param_1 = fract(uv);
        _244 = float4(testCard(param_1), 1.0);
    }
    return _244;
}

static inline __attribute__((always_inline))
float2 pairLocal(thread const float2& fragCoord, constant FlairUniforms& _102)
{
    float2 hs = fast::max((_102.uSize * 0.5) * float2(_102.iResolution[0], _102.iResolution[1]), float2(1.0));
    float2 p = fragCoord - (_102.uCentre * float2(_102.iResolution[0], _102.iResolution[1]));
    p.x = abs(p.x) - (_102.uSpacing * _102.iResolution[0u]);
    return p / hs;
}

static inline __attribute__((always_inline))
float pairRegion(thread const float2& fragCoord, constant FlairUniforms& _102)
{
    float2 hs = fast::max((_102.uSize * 0.5) * float2(_102.iResolution[0], _102.iResolution[1]), float2(1.0));
    float2 param = fragCoord;
    float d = (length(pairLocal(param, _102)) - 1.0) * fast::min(hs.x, hs.y);
    return 1.0 - smoothstep(((-0.5) * _102.uFeather) - 0.5, (0.5 * _102.uFeather) + 0.5, d);
}

static inline __attribute__((always_inline))
float skinLike(thread const float3& c)
{
    float y = dot(c, float3(0.2989999949932098388671875, 0.58700001239776611328125, 0.114000000059604644775390625));
    float cb = ((0.5 - (0.16869999468326568603515625 * c.x)) - (0.3312999904155731201171875 * c.y)) + (0.5 * c.z);
    float cr = ((0.5 + (0.5 * c.x)) - (0.4187000095844268798828125 * c.y)) - (0.081299997866153717041015625 * c.z);
    return (((smoothstep(0.5299999713897705078125, 0.569999992847442626953125, cr) * smoothstep(0.7200000286102294921875, 0.680000007152557373046875, cr)) * smoothstep(0.2800000011920928955078125, 0.319999992847442626953125, cb)) * smoothstep(0.519999980926513671875, 0.4799999892711639404296875, cb)) * smoothstep(0.0599999986588954925537109375, 0.1599999964237213134765625, y);
}

static inline __attribute__((always_inline))
float3 toOklab(thread float3& c)
{
    c = powr(fast::max(c, float3(0.0)), float3(2.2000000476837158203125));
    float3 lms = float3x3(float3(0.4122000038623809814453125, 0.2118999958038330078125, 0.088299997150897979736328125), float3(0.536300003528594970703125, 0.680700004100799560546875, 0.2816999852657318115234375), float3(0.051399998366832733154296875, 0.107400000095367431640625, 0.62999999523162841796875)) * c;
    lms = powr(lms, float3(0.3333333432674407958984375));
    return float3x3(float3(0.2105000019073486328125, 1.97800004482269287109375, 0.02590000070631504058837890625), float3(0.793600022792816162109375, -2.4286000728607177734375, 0.782800018787384033203125), float3(-0.0041000000201165676116943359375, 0.4505999982357025146484375, -0.808700025081634521484375)) * lms;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _102, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param = fragCoord / float2(_102.iResolution[0], _102.iResolution[1]);
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _102);
    float2 param_1 = fragCoord;
    float3 param_2 = pic.xyz;
    float m = pairRegion(param_1, _102) * mix(1.0, skinLike(param_2), _102.uSkinOnly);
    if (m <= 0.0)
    {
        fragColor = pic;
        return;
    }
    float3 param_3 = pic.xyz;
    float3 _472 = toOklab(param_3);
    float L = _472.x;
    float sheen = _102.uSheen * smoothstep(0.300000011920928955078125, 0.89999997615814208984375, L);
    float2 cell = floor(fragCoord / float2(fast::max(_102.uGrain, 1.0)));
    float2 param_4 = cell;
    float h = hash12(param_4);
    float2 param_5 = cell + float2(19.700000762939453125);
    float on = step(1.0 - _102.uDensity, hash12(param_5));
    float k = 1.0 + floor(h * 4.0);
    float fleck = powr(0.5 + (0.5 * sin(((_102.iTime * 1.57079994678497314453125) * k) + (h * 6.28318023681640625))), 10.0) * on;
    float3 col = pic.xyz + ((float3(1.0) - pic.xyz) * fast::clamp((float3(_102.uColour) * (sheen + ((fleck * _102.uGlitter) * (0.4000000059604644775390625 + L)))) * m, float3(0.0), float3(1.0)));
    fragColor = float4(col, pic.w);
}

fragment flair_beauty_highlighter_frag_out flair_beauty_highlighter_frag(constant FlairUniforms& _102 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_beauty_highlighter_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _580;
    if (_102.flair_flipY > 0.5)
    {
        _580 = _102.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _580 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _580);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _102, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

